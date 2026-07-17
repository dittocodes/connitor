"""Attendant pass lifecycle — family visit passes for admitted patients."""

from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import timedelta

from fastapi import UploadFile
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.delivery.utils import bad_request, not_found
from app.models import Branch
from app.models.attendant_entities import (
    Admission,
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
        return self._serialize_attendant(attendant)

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
        govt_id_file: UploadFile,
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

        if not govt_id_file or not govt_id_file.filename:
            raise bad_request("Government ID image is required")

        image_url = await self.gcp.upload_visitor_document(
            govt_id_file, pass_row.id, "attendant-govt-id"
        )

        self.db.add(
            AttendantPassScan(
                passId=pass_row.id,
                scannedById=user["id"],
                scanType=scan_type or "ENTRY",
                govtIdImageUrl=image_url,
                govtIdType=govt_id_type,
            )
        )
        self.db.commit()
        return {
            "valid": True,
            "passNumber": pass_row.passNumber,
            "scanType": scan_type or "ENTRY",
            "govtIdImageUrl": image_url,
            "attendant": self._serialize_attendant(pass_row.attendant) if pass_row.attendant else None,
            "admission": (
                self._serialize_admission(pass_row.attendant.admission)
                if pass_row.attendant and pass_row.attendant.admission
                else None
            ),
        }

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
        active_pass = self._active_pass_for_admission(admission.id)
        return {
            "admissionId": admission.id,
            "patientFirstName": patient.firstName,
            "wardName": admission.wardName,
            "roomNumber": admission.roomNumber,
            "hasActivePass": active_pass is not None,
            "branchId": admission.branchId,
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

    def _serialize_admission(self, admission: Admission) -> dict:
        patient = admission.patient
        if not patient:
            patient = self.db.get(Patient, admission.patientId)
        active = self._active_pass_for_admission(admission.id)
        return {
            "id": admission.id,
            "status": admission.status,
            "wardName": admission.wardName,
            "roomNumber": admission.roomNumber,
            "bedNumber": admission.bedNumber,
            "branchId": admission.branchId,
            "admittedAt": admission.admittedAt.isoformat() if admission.admittedAt else None,
            "hasActivePass": active is not None,
            "activePassId": active.id if active else None,
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
        }
        if full:
            attendant = pass_row.attendant
            if not attendant:
                attendant = self.db.get(Attendant, pass_row.attendantId)
            data["qrPayload"] = pass_row.qrPayload
            data["qrSignature"] = pass_row.qrSignature
            data["attendant"] = self._serialize_attendant(attendant) if attendant else None
        return data
