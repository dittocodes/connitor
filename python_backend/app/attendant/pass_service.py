"""Attendant pass lifecycle — family visit passes for admitted patients."""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
from datetime import date, datetime, timedelta

from fastapi import UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.delivery.utils import bad_request, not_found
from app.models import Branch
from app.models.attendant_entities import (
    Admission,
    AdmissionVisitSlot,
    Attendant,
    AttendantPass,
    AttendantPassNumberSequence,
    AttendantPassScan,
    Patient,
)
from app.services.auth_service import AuthService
from app.services.gcp_storage_service import GcpStorageService
from app.services.messaging_service import EmailService
from app.utils.timezone import format_ist_datetime, now_ist

logger = logging.getLogger(__name__)

PASS_VALIDITY_HOURS = 24
# Hospital-wide default visiting window for every inpatient (IST), every day.
DEFAULT_VISIT_START = "11:00"
DEFAULT_VISIT_END = "16:00"
_TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


class AttendantPassService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.email = EmailService()
        self.gcp = GcpStorageService()

    def _next_pass_number(self) -> str:
        year = now_ist().year
        seq = self.db.get(AttendantPassNumberSequence, year)
        if not seq:
            seq = AttendantPassNumberSequence(year=year, lastNumber=0)
            self.db.add(seq)
        seq.lastNumber += 1
        self.db.flush()
        return f"AP-{year}-{seq.lastNumber:06d}"

    @staticmethod
    def _parse_hhmm(value: str) -> int:
        match = _TIME_RE.match((value or "").strip())
        if not match:
            raise bad_request("Time must be HH:MM (24-hour)")
        return int(match.group(1)) * 60 + int(match.group(2))

    @staticmethod
    def _format_hhmm(minutes: int) -> str:
        h, m = divmod(max(0, minutes), 60)
        return f"{h:02d}:{m:02d}"

    def _default_visit_window(self, branch_id: str) -> tuple[str, str]:
        """Hospital default visiting hours for every inpatient, every day (IST)."""
        _ = branch_id  # reserved for future PassPolicy overrides
        return DEFAULT_VISIT_START, DEFAULT_VISIT_END

    def get_visiting_hours(self, admission_id: str, *, on_date: date | None = None) -> dict:
        admission = self.db.get(Admission, admission_id)
        if not admission:
            raise not_found("Admission")
        day = on_date or now_ist().date()
        start, end = self._default_visit_window(admission.branchId)
        extras = (
            self.db.query(AdmissionVisitSlot)
            .filter(
                AdmissionVisitSlot.admissionId == admission_id,
                AdmissionVisitSlot.isActive.is_(True),
                or_(
                    AdmissionVisitSlot.visitDate.is_(None),
                    AdmissionVisitSlot.visitDate == day,
                ),
            )
            .order_by(AdmissionVisitSlot.startTime.asc())
            .all()
        )
        return {
            "admissionId": admission_id,
            "date": day.isoformat(),
            "defaultWindow": {
                "startTime": start,
                "endTime": end,
                "label": "Hospital visiting hours",
                "everyDay": True,
            },
            "extraSlots": [self._serialize_visit_slot(s) for s in extras],
            "summary": self._visiting_hours_summary(start, end, extras),
        }

    def _visiting_hours_summary(
        self, default_start: str, default_end: str, extras: list[AdmissionVisitSlot]
    ) -> str:
        parts = [f"{default_start}–{default_end} (default)"]
        for slot in extras:
            label = slot.label or "extra"
            date_bit = slot.visitDate.isoformat() if slot.visitDate else "daily"
            parts.append(f"{slot.startTime}–{slot.endTime} ({label}, {date_bit})")
        return "; ".join(parts)

    def is_within_visiting_hours(
        self, admission_id: str, *, when: datetime | None = None
    ) -> bool:
        when = when or now_ist()
        hours = self.get_visiting_hours(admission_id, on_date=when.date())
        minutes = when.hour * 60 + when.minute
        default = hours["defaultWindow"]
        start = self._parse_hhmm(default["startTime"])
        end = self._parse_hhmm(default["endTime"])
        if start <= minutes <= end:
            return True
        for slot in hours["extraSlots"]:
            s = self._parse_hhmm(slot["startTime"])
            e = self._parse_hhmm(slot["endTime"])
            if s <= minutes <= e:
                return True
        return False

    def assert_within_visiting_hours(self, admission_id: str) -> None:
        if self.is_within_visiting_hours(admission_id):
            return
        hours = self.get_visiting_hours(admission_id)
        raise bad_request(
            "Outside visiting hours. Allowed today: "
            f"{hours['summary']}. Default hospital hours are "
            f"{DEFAULT_VISIT_START}–{DEFAULT_VISIT_END} IST every day."
        )

    def list_visit_slots(self, branch_id: str, *, admission_id: str | None = None) -> dict:
        q = (
            self.db.query(AdmissionVisitSlot)
            .options(
                joinedload(AdmissionVisitSlot.admission).joinedload(Admission.patient)
            )
            .filter(
                AdmissionVisitSlot.branchId == branch_id,
                AdmissionVisitSlot.isActive.is_(True),
            )
        )
        if admission_id:
            q = q.filter(AdmissionVisitSlot.admissionId == admission_id)
        rows = q.order_by(AdmissionVisitSlot.createdAt.desc()).all()
        default_start, default_end = self._default_visit_window(branch_id)
        return {
            "defaultWindow": {
                "startTime": default_start,
                "endTime": default_end,
                "label": "Hospital visiting hours (all patients, every day)",
                "everyDay": True,
            },
            "items": [self._serialize_visit_slot(s, with_patient=True) for s in rows],
        }

    def create_visit_slot(self, user: dict, data: dict) -> dict:
        admission = self.db.get(Admission, data["admissionId"])
        if not admission:
            raise not_found("Admission")
        if admission.status != "ACTIVE":
            raise bad_request("Admission is not active")
        user_branch = user.get("branchId")
        if (
            user_branch
            and admission.branchId != user_branch
            and user.get("role") not in ("SUPER_ADMIN", "HOSPITAL_ADMIN")
        ):
            raise bad_request("Admission belongs to another branch")

        start = data["startTime"].strip()
        end = data["endTime"].strip()
        start_m = self._parse_hhmm(start)
        end_m = self._parse_hhmm(end)
        if end_m <= start_m:
            raise bad_request("End time must be after start time")

        visit_date: date | None = None
        raw_date = data.get("visitDate")
        if raw_date:
            try:
                visit_date = date.fromisoformat(str(raw_date).strip())
            except ValueError as exc:
                raise bad_request("visitDate must be YYYY-MM-DD") from exc

        slot = AdmissionVisitSlot(
            admissionId=admission.id,
            branchId=admission.branchId,
            visitDate=visit_date,
            startTime=self._format_hhmm(start_m),
            endTime=self._format_hhmm(end_m),
            label=(data.get("label") or "").strip() or None,
            createdById=user.get("id"),
            isActive=True,
        )
        self.db.add(slot)
        self.db.commit()
        self.db.refresh(slot)
        return self._serialize_visit_slot(slot, with_patient=True)

    def delete_visit_slot(self, user: dict, slot_id: str) -> dict:
        slot = self.db.get(AdmissionVisitSlot, slot_id)
        if not slot or not slot.isActive:
            raise not_found("Visit slot")
        user_branch = user.get("branchId")
        if (
            user_branch
            and slot.branchId != user_branch
            and user.get("role") not in ("SUPER_ADMIN", "HOSPITAL_ADMIN")
        ):
            raise bad_request("Visit slot belongs to another branch")
        slot.isActive = False
        self.db.commit()
        return {"id": slot.id, "deleted": True}

    def _serialize_visit_slot(
        self, slot: AdmissionVisitSlot, *, with_patient: bool = False
    ) -> dict:
        payload = {
            "id": slot.id,
            "admissionId": slot.admissionId,
            "branchId": slot.branchId,
            "visitDate": slot.visitDate.isoformat() if slot.visitDate else None,
            "startTime": slot.startTime,
            "endTime": slot.endTime,
            "label": slot.label,
            "everyDay": slot.visitDate is None,
            "isActive": slot.isActive,
            "createdAt": slot.createdAt.isoformat() if slot.createdAt else None,
        }
        if with_patient:
            admission = slot.admission or self.db.get(Admission, slot.admissionId)
            patient = None
            if admission:
                patient = admission.patient or self.db.get(Patient, admission.patientId)
            payload["patient"] = (
                {
                    "id": patient.id,
                    "mrn": patient.mrn,
                    "name": f"{patient.firstName} {patient.lastName}".strip(),
                }
                if patient
                else None
            )
            payload["wardName"] = admission.wardName if admission else None
            payload["roomNumber"] = admission.roomNumber if admission else None
        return payload

    def _sign_payload(self, payload: str) -> str:
        secret = get_settings().jwt_secret
        return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

    def _active_pass_for_admission(self, admission_id: str) -> AttendantPass | None:
        now = now_ist()
        rows = (
            self.db.query(AttendantPass)
            .join(Attendant, Attendant.id == AttendantPass.attendantId)
            .filter(
                Attendant.admissionId == admission_id,
                AttendantPass.status == "ACTIVE",
            )
            .all()
        )
        for pass_row in rows:
            expired_at = pass_row.expiresAt or pass_row.validTo
            if expired_at and expired_at < now:
                pass_row.status = "EXPIRED"
                continue
            return pass_row
        if any(r.status == "EXPIRED" for r in rows):
            self.db.commit()
        return None

    @staticmethod
    def _is_inside(pass_row: AttendantPass) -> bool:
        return bool(pass_row.enteredAt and not pass_row.exitedAt)

    def _inside_pass_for_admission(self, admission_id: str) -> AttendantPass | None:
        rows = (
            self.db.query(AttendantPass)
            .join(Attendant, Attendant.id == AttendantPass.attendantId)
            .filter(
                Attendant.admissionId == admission_id,
                AttendantPass.enteredAt.isnot(None),
                AttendantPass.exitedAt.is_(None),
            )
            .order_by(AttendantPass.enteredAt.desc())
            .all()
        )
        for pass_row in rows:
            if pass_row.status == "EXPIRED":
                continue
            return pass_row
        return None

    def create_patient(self, user: dict, data: dict) -> dict:
        branch_id = data.get("branchId") or user.get("branchId")
        if not branch_id:
            raise bad_request("branchId is required")
        patient = Patient(
            branchId=branch_id,
            mrn=data["mrn"].strip(),
            firstName=data["firstName"].strip(),
            lastName=data["lastName"].strip(),
            phone=data.get("phone"),
        )
        self.db.add(patient)
        self.db.commit()
        self.db.refresh(patient)
        return {
            "id": patient.id,
            "mrn": patient.mrn,
            "name": f"{patient.firstName} {patient.lastName}",
            "branchId": patient.branchId,
        }

    def create_admission(self, user: dict, data: dict) -> dict:
        patient = self.db.get(Patient, data["patientId"])
        if not patient:
            raise not_found("Patient")
        admission = Admission(
            patientId=patient.id,
            branchId=data.get("branchId") or patient.branchId,
            wardName=data.get("wardName"),
            roomNumber=data.get("roomNumber"),
            bedNumber=data.get("bedNumber"),
            status="ACTIVE",
        )
        self.db.add(admission)
        self.db.commit()
        self.db.refresh(admission)
        return self._serialize_admission(admission)

    def register_attendant(self, user: dict, data: dict) -> dict:
        return self._create_attendant(data)

    def public_apply(self, data: dict) -> dict:
        return self._create_attendant(data)

    def _create_attendant(self, data: dict) -> dict:
        admission = self.db.get(Admission, data["admissionId"])
        if not admission:
            raise not_found("Admission")
        if admission.status != "ACTIVE":
            raise bad_request("Admission is not active")
        inside = self._inside_pass_for_admission(admission.id)
        if inside:
            raise bad_request(
                "An attendant is currently inside for this patient. "
                "They must check out at security before another person can apply."
            )
        email = AuthService.normalize_email(data["email"])
        attendant = Attendant(
            admissionId=admission.id,
            branchId=admission.branchId,
            name=data["name"].strip(),
            email=email,
            phone=str(data["phone"]).strip(),
            relationship=data.get("relationship"),
            status="PENDING",
        )
        self.db.add(attendant)
        self.db.commit()
        self.db.refresh(attendant)

        # Eager-load admission/patient for ward notification email
        attendant = (
            self.db.query(Attendant)
            .options(joinedload(Attendant.admission).joinedload(Admission.patient))
            .filter(Attendant.id == attendant.id)
            .first()
        )
        assert attendant is not None

        notify: dict = {"emailsSent": 0, "recipients": []}
        try:
            from app.attendant.approval_link_service import AttendantApprovalLinkService

            notify = AttendantApprovalLinkService(self.db).notify_ward_admins(attendant)
        except Exception as exc:
            logger.error(
                "Failed to notify ward for attendant %s: %s",
                attendant.id,
                exc,
            )

        result = self._serialize_attendant(attendant)
        result["wardNotified"] = bool(notify.get("emailsSent"))
        result["wardRecipients"] = notify.get("recipients") or []
        return result

    def approve_attendant(self, user: dict, attendant_id: str) -> dict:
        attendant = self.db.get(Attendant, attendant_id)
        if not attendant:
            raise not_found("Attendant")
        if attendant.status not in ("PENDING", "APPROVED"):
            raise bad_request("Attendant cannot be approved from current status")
        attendant.status = "APPROVED"
        self.db.commit()
        return self._serialize_attendant(attendant)

    def issue_pass(self, user: dict, attendant_id: str, *, revoke_existing: bool = False) -> dict:
        attendant = (
            self.db.query(Attendant)
            .options(joinedload(Attendant.admission).joinedload(Admission.patient))
            .filter(Attendant.id == attendant_id)
            .first()
        )
        if not attendant:
            raise not_found("Attendant")
        if attendant.status != "APPROVED":
            raise bad_request("Attendant must be approved before pass issuance")

        existing = self._active_pass_for_admission(attendant.admissionId)
        if existing:
            if not revoke_existing:
                raise bad_request(
                    "An ACTIVE pass already exists for this admission. "
                    "Revoke it first or set revokeExisting=true."
                )
            existing.status = "REVOKED"
            self.db.flush()

        now = now_ist()
        expires = now + timedelta(hours=PASS_VALIDITY_HOURS)
        pass_row = AttendantPass(
            passNumber=self._next_pass_number(),
            attendantId=attendant.id,
            branchId=attendant.branchId,
            status="ACTIVE",
            validFrom=now,
            validTo=expires,
            expiresAt=expires,
            approvedById=user.get("id"),
        )
        self.db.add(pass_row)
        self.db.flush()

        payload = f"PASS:{pass_row.id}:{attendant.id}:{now.isoformat()}"
        signature = self._sign_payload(payload)
        pass_row.qrPayload = payload
        pass_row.qrSignature = signature
        self.db.commit()
        self.db.refresh(pass_row)

        email_sent = self._email_pass(attendant, pass_row)
        result = self._serialize_pass(pass_row, full=True)
        result["emailSent"] = email_sent
        return result

    def revoke_pass(self, user: dict, pass_id: str) -> dict:
        pass_row = self.db.get(AttendantPass, pass_id)
        if not pass_row:
            raise not_found("Pass")
        if pass_row.status != "ACTIVE":
            raise bad_request("Only ACTIVE passes can be revoked")
        pass_row.status = "REVOKED"
        self.db.commit()
        return self._serialize_pass(pass_row)

    async def scan_pass(
        self,
        user: dict,
        *,
        qr_payload: str,
        signature: str,
        govt_id_file: UploadFile | None = None,
        scan_type: str = "ENTRY",
        govt_id_type: str | None = None,
    ) -> dict:
        expected = self._sign_payload(qr_payload)
        if not hmac.compare_digest(expected, signature):
            raise bad_request("Invalid QR signature")

        pass_row = (
            self.db.query(AttendantPass)
            .options(
                joinedload(AttendantPass.attendant)
                .joinedload(Attendant.admission)
                .joinedload(Admission.patient)
            )
            .filter(AttendantPass.qrPayload == qr_payload)
            .first()
        )
        if not pass_row:
            raise not_found("Pass")
        if pass_row.status != "ACTIVE":
            raise bad_request(f"Pass is {pass_row.status}")
        if pass_row.expiresAt and pass_row.expiresAt < now_ist():
            pass_row.status = "EXPIRED"
            self.db.commit()
            raise bad_request("Pass expired")
        if pass_row.validTo and pass_row.validTo < now_ist():
            pass_row.status = "EXPIRED"
            self.db.commit()
            raise bad_request("Pass expired")

        user_branch = user.get("branchId")
        if (
            user_branch
            and pass_row.branchId != user_branch
            and user.get("role") not in ("SUPER_ADMIN", "HOSPITAL_ADMIN")
        ):
            raise bad_request("Pass belongs to another branch")

        # Prefer EXIT when already inside if client sent ENTRY by default
        requested = (scan_type or "ENTRY").upper()
        if requested == "ENTRY" and self._is_inside(pass_row):
            requested = "EXIT"
        if requested not in ("ENTRY", "EXIT"):
            raise bad_request("scanType must be ENTRY or EXIT")

        image_url: str | None = None
        if requested == "ENTRY":
            if self._is_inside(pass_row):
                raise bad_request("Attendant is already inside — scan for EXIT")
            if pass_row.exitedAt:
                raise bad_request("This pass was already used for a completed visit")
            attendant = pass_row.attendant or self.db.get(Attendant, pass_row.attendantId)
            if attendant:
                self.assert_within_visiting_hours(attendant.admissionId)
            if not govt_id_file or not govt_id_file.filename:
                raise bad_request("Government ID image is required for entry")
            image_url = await self.gcp.upload_visitor_document(
                govt_id_file, pass_row.id, "attendant-govt-id"
            )
            pass_row.enteredAt = now_ist()
            pass_row.exitedAt = None
            pass_row.durationMinutes = None
        else:
            if not self._is_inside(pass_row):
                raise bad_request("Attendant is not inside — scan for ENTRY first")
            if govt_id_file and govt_id_file.filename:
                image_url = await self.gcp.upload_visitor_document(
                    govt_id_file, pass_row.id, "attendant-govt-id"
                )
            exit_time = now_ist()
            pass_row.exitedAt = exit_time
            if pass_row.enteredAt:
                pass_row.durationMinutes = max(
                    0, int((exit_time - pass_row.enteredAt).total_seconds() // 60)
                )

        self.db.add(
            AttendantPassScan(
                passId=pass_row.id,
                scannedById=user["id"],
                scanType=requested,
                govtIdImageUrl=image_url,
                govtIdType=govt_id_type,
            )
        )
        self.db.commit()
        self.db.refresh(pass_row)

        notify_result: dict = {"emailsSent": 0, "recipients": []}
        if requested == "EXIT":
            try:
                notify_result = self._notify_visit_exit(pass_row) or notify_result
            except Exception as exc:
                logger.error("Failed attendant exit notifications for %s: %s", pass_row.id, exc)

        return {
            "valid": True,
            "passNumber": pass_row.passNumber,
            "scanType": requested,
            "isInside": self._is_inside(pass_row),
            "enteredAt": pass_row.enteredAt.isoformat() if pass_row.enteredAt else None,
            "exitedAt": pass_row.exitedAt.isoformat() if pass_row.exitedAt else None,
            "durationMinutes": pass_row.durationMinutes,
            "govtIdImageUrl": image_url,
            "emailsSent": notify_result.get("emailsSent", 0),
            "emailRecipients": notify_result.get("recipients") or [],
            "attendant": self._serialize_attendant(pass_row.attendant) if pass_row.attendant else None,
            "admission": (
                self._serialize_admission(pass_row.attendant.admission)
                if pass_row.attendant and pass_row.attendant.admission
                else None
            ),
            "pass": self._serialize_pass(pass_row, full=True),
        }

    def _notify_visit_exit(self, pass_row: AttendantPass) -> dict:
        """Email attendant (visitor) + ward + security with visit duration summary."""
        from app.email_templates import build_attendant_visit_exit_email
        from app.models import User
        from app.models.enums import Role

        attendant = pass_row.attendant or self.db.get(Attendant, pass_row.attendantId)
        if not attendant:
            logger.warning("Attendant exit notify skipped — no attendant on pass %s", pass_row.id)
            return {"emailsSent": 0, "recipients": []}
        admission = attendant.admission or self.db.get(Admission, attendant.admissionId)
        patient = None
        if admission:
            patient = admission.patient or self.db.get(Patient, admission.patientId)
        branch = self.db.get(Branch, pass_row.branchId)
        patient_name = (
            f"{patient.firstName} {patient.lastName}".strip() if patient else "Patient"
        )
        mrn = patient.mrn if patient else "—"
        hospital_name = branch.name if branch else "Hospital"
        entry_label = format_ist_datetime(pass_row.enteredAt) if pass_row.enteredAt else "—"
        exit_label = format_ist_datetime(pass_row.exitedAt) if pass_row.exitedAt else "—"
        settings = get_settings()

        targets: list[tuple[str, str]] = []
        if attendant.email and "@placeholder.local" not in attendant.email:
            targets.append((attendant.email, attendant.name))
        else:
            logger.warning(
                "Attendant %s has no usable email — visit exit mail to visitor skipped",
                attendant.id,
            )

        ward_users = (
            self.db.query(User)
            .filter(
                User.branchId == pass_row.branchId,
                User.role == "WARD_ADMIN",
                User.isActive.is_(True),
            )
            .all()
        )
        if not ward_users:
            ward_users = (
                self.db.query(User)
                .filter(
                    User.branchId == pass_row.branchId,
                    User.role == Role.HOSPITAL_ADMIN.value,
                    User.isActive.is_(True),
                )
                .all()
            )
        for u in ward_users:
            if u.email:
                targets.append((u.email, u.name or "Ward Admin"))

        security_users = (
            self.db.query(User)
            .filter(
                User.branchId == pass_row.branchId,
                User.role.in_([Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value]),
                User.isActive.is_(True),
            )
            .all()
        )
        for u in security_users:
            if u.email:
                targets.append((u.email, u.name or "Security"))

        seen: set[str] = set()
        sent: list[str] = []
        for to_email, recipient_name in targets:
            key = to_email.lower()
            if key in seen:
                continue
            seen.add(key)
            try:
                subject, text_body, html_body = build_attendant_visit_exit_email(
                    recipient_name=recipient_name,
                    attendant_name=attendant.name,
                    patient_name=patient_name,
                    mrn=mrn,
                    pass_number=pass_row.passNumber,
                    ward_name=admission.wardName if admission else None,
                    room_number=admission.roomNumber if admission else None,
                    hospital_name=hospital_name,
                    entry_label=entry_label,
                    exit_label=exit_label,
                    duration_minutes=pass_row.durationMinutes,
                    company_name=settings.email_from_name,
                    product_name=settings.email_product_name,
                )
                self.email._deliver_email(
                    to_email, subject, text_body, html_body, context="attendant exit"
                )
                sent.append(to_email)
            except Exception as exc:
                logger.error("Failed attendant exit email to %s: %s", to_email, exc)

        return {"emailsSent": len(sent), "recipients": sent}

    def list_passes(self, branch_id: str, skip: int = 0, limit: int = 50) -> dict:
        q = (
            self.db.query(AttendantPass)
            .options(
                joinedload(AttendantPass.attendant)
                .joinedload(Attendant.admission)
                .joinedload(Admission.patient)
            )
            .filter(AttendantPass.branchId == branch_id)
        )
        total = q.count()
        rows = q.order_by(AttendantPass.createdAt.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [self._serialize_pass(p, full=True) for p in rows]}

    def list_admissions(self, branch_id: str, skip: int = 0, limit: int = 50) -> dict:
        q = (
            self.db.query(Admission)
            .options(joinedload(Admission.patient))
            .filter(Admission.branchId == branch_id, Admission.status == "ACTIVE")
        )
        total = q.count()
        rows = q.order_by(Admission.admittedAt.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [self._serialize_admission(a) for a in rows]}

    def list_attendants(
        self, branch_id: str, *, admission_id: str | None = None, skip: int = 0, limit: int = 50
    ) -> dict:
        q = (
            self.db.query(Attendant)
            .options(joinedload(Attendant.admission).joinedload(Admission.patient))
            .filter(Attendant.branchId == branch_id)
        )
        if admission_id:
            q = q.filter(Attendant.admissionId == admission_id)
        total = q.count()
        rows = q.order_by(Attendant.createdAt.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [self._serialize_attendant(a) for a in rows]}

    def lookup_admission_by_mrn(self, branch_id: str, mrn: str) -> dict:
        patient = (
            self.db.query(Patient)
            .filter(Patient.branchId == branch_id, Patient.mrn == mrn.strip(), Patient.isActive.is_(True))
            .first()
        )
        if not patient:
            raise not_found("Patient")
        admission = (
            self.db.query(Admission)
            .filter(Admission.patientId == patient.id, Admission.status == "ACTIVE")
            .order_by(Admission.admittedAt.desc())
            .first()
        )
        if not admission:
            raise not_found("Active admission")
        return self._serialize_admission_lookup(admission)

    def search_admissions_by_name(self, branch_id: str, query: str, *, limit: int = 20) -> dict:
        term = query.strip().lower()
        if len(term) < 2:
            return {"items": []}

        pattern = f"%{term}%"
        rows = (
            self.db.query(Admission)
            .join(Patient, Patient.id == Admission.patientId)
            .options(joinedload(Admission.patient))
            .filter(
                Admission.branchId == branch_id,
                Admission.status == "ACTIVE",
                Patient.isActive.is_(True),
                (
                    func.lower(Patient.firstName).like(pattern)
                    | func.lower(Patient.lastName).like(pattern)
                    | func.lower(Patient.firstName + " " + Patient.lastName).like(pattern)
                ),
            )
            .order_by(Admission.admittedAt.desc())
            .limit(limit)
            .all()
        )
        return {"items": [self._serialize_admission_lookup(a) for a in rows]}

    def _serialize_admission_lookup(self, admission: Admission) -> dict:
        patient = admission.patient
        if not patient:
            patient = self.db.get(Patient, admission.patientId)
        active_pass = self._active_pass_for_admission(admission.id)
        inside = self._inside_pass_for_admission(admission.id)
        hours = self.get_visiting_hours(admission.id)
        return {
            "admissionId": admission.id,
            "patientFirstName": patient.firstName if patient else "",
            "patientLastName": patient.lastName if patient else "",
            "patientName": f"{patient.firstName} {patient.lastName}".strip() if patient else "Patient",
            "mrn": patient.mrn if patient else "",
            "wardName": admission.wardName,
            "roomNumber": admission.roomNumber,
            "hasActivePass": active_pass is not None,
            "hasAttendantInside": inside is not None,
            "branchId": admission.branchId,
            "visitingHours": hours,
        }

    def _serialize_admission(self, admission: Admission) -> dict:
        patient = admission.patient
        if not patient:
            patient = self.db.get(Patient, admission.patientId)
        active = self._active_pass_for_admission(admission.id)
        inside = self._inside_pass_for_admission(admission.id)
        hours = self.get_visiting_hours(admission.id)
        return {
            "id": admission.id,
            "status": admission.status,
            "wardName": admission.wardName,
            "roomNumber": admission.roomNumber,
            "bedNumber": admission.bedNumber,
            "branchId": admission.branchId,
            "admittedAt": admission.admittedAt.isoformat() if admission.admittedAt else None,
            "hasActivePass": active is not None,
            "hasAttendantInside": inside is not None,
            "activePassId": active.id if active else None,
            "visitingHours": hours,
            "patient": {
                "id": patient.id,
                "mrn": patient.mrn,
                "firstName": patient.firstName,
                "lastName": patient.lastName,
                "name": f"{patient.firstName} {patient.lastName}",
            }
            if patient
            else None,
        }

    def _email_pass(self, attendant: Attendant, pass_row: AttendantPass) -> bool:
        if not attendant.email or "@placeholder.local" in attendant.email:
            logger.warning("Skipping attendant pass email for %s (missing email)", attendant.id)
            return False
        admission = attendant.admission or self.db.get(Admission, attendant.admissionId)
        patient = admission.patient if admission else None
        if admission and not patient:
            patient = self.db.get(Patient, admission.patientId)
        branch = self.db.get(Branch, attendant.branchId)
        address = ""
        if branch:
            address = ", ".join(
                p for p in (branch.street, branch.city, branch.state, branch.pinCode) if p
            )
        try:
            self.email.send_attendant_pass_email(
                attendant.email,
                attendant_name=attendant.name,
                pass_number=pass_row.passNumber,
                patient_first_name=patient.firstName if patient else "Patient",
                ward_name=admission.wardName if admission else None,
                room_number=admission.roomNumber if admission else None,
                hospital_name=branch.name if branch else "Hospital",
                hospital_address=address,
                hospital_phone=branch.phone if branch else "",
                valid_until=format_ist_datetime(pass_row.validTo or pass_row.expiresAt),
                qr_payload=pass_row.qrPayload,
                qr_signature=pass_row.qrSignature,
                qr_expires_at=format_ist_datetime(pass_row.expiresAt),
            )
            return True
        except Exception as exc:
            logger.error("Failed to email attendant pass to %s: %s", attendant.email, exc)
            return False

    def _serialize_attendant(self, attendant: Attendant) -> dict:
        admission = attendant.admission
        return {
            "id": attendant.id,
            "name": attendant.name,
            "email": attendant.email,
            "phone": attendant.phone,
            "relationship": attendant.relationship,
            "status": attendant.status,
            "admissionId": attendant.admissionId,
            "branchId": attendant.branchId,
            "createdAt": attendant.createdAt.isoformat() if attendant.createdAt else None,
            "admission": self._serialize_admission(admission) if admission else None,
        }

    def _serialize_pass(self, pass_row: AttendantPass, *, full: bool = False) -> dict:
        data = {
            "id": pass_row.id,
            "passNumber": pass_row.passNumber,
            "status": pass_row.status,
            "attendantId": pass_row.attendantId,
            "branchId": pass_row.branchId,
            "validFrom": pass_row.validFrom.isoformat() if pass_row.validFrom else None,
            "validTo": pass_row.validTo.isoformat() if pass_row.validTo else None,
            "expiresAt": pass_row.expiresAt.isoformat() if pass_row.expiresAt else None,
            "enteredAt": pass_row.enteredAt.isoformat() if pass_row.enteredAt else None,
            "exitedAt": pass_row.exitedAt.isoformat() if pass_row.exitedAt else None,
            "durationMinutes": pass_row.durationMinutes,
            "isInside": self._is_inside(pass_row),
        }
        if full:
            attendant = pass_row.attendant
            if not attendant:
                attendant = self.db.get(Attendant, pass_row.attendantId)
            data["qrPayload"] = pass_row.qrPayload
            data["qrSignature"] = pass_row.qrSignature
            data["attendant"] = self._serialize_attendant(attendant) if attendant else None
        return data

    def list_public_branches(self) -> list[dict]:
        branches = (
            self.db.query(Branch)
            .options(joinedload(Branch.hospitalChain))
            .order_by(Branch.name)
            .all()
        )
        return [
            {
                "id": b.id,
                "name": b.name,
                "city": b.city,
                "state": b.state,
                "hospitalChainId": b.hospitalChainId,
                "hospitalChainName": b.hospitalChain.name if b.hospitalChain else None,
            }
            for b in branches
        ]
