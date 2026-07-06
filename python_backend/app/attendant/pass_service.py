"""Attendant pass lifecycle."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.delivery.utils import bad_request, not_found
from app.models.attendant_entities import (
    Admission,
    Attendant,
    AttendantPass,
    AttendantPassNumberSequence,
    AttendantPassScan,
    Patient,
)
from app.utils.timezone import now_ist


class AttendantPassService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _next_pass_number(self) -> str:
        year = now_ist().year
        seq = self.db.get(AttendantPassNumberSequence, year)
        if not seq:
            seq = AttendantPassNumberSequence(year=year, lastNumber=0)
            self.db.add(seq)
        seq.lastNumber += 1
        self.db.flush()
        return f"AP-{year}-{seq.lastNumber:06d}"

    def create_patient(self, user: dict, data: dict) -> dict:
        patient = Patient(
            branchId=data["branchId"],
            mrn=data["mrn"],
            firstName=data["firstName"],
            lastName=data["lastName"],
            phone=data.get("phone"),
        )
        self.db.add(patient)
        self.db.commit()
        self.db.refresh(patient)
        return {"id": patient.id, "mrn": patient.mrn, "name": f"{patient.firstName} {patient.lastName}"}

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
        )
        self.db.add(admission)
        self.db.commit()
        self.db.refresh(admission)
        return {"id": admission.id, "status": admission.status}

    def register_attendant(self, user: dict, data: dict) -> dict:
        admission = self.db.get(Admission, data["admissionId"])
        if not admission:
            raise not_found("Admission")
        attendant = Attendant(
            admissionId=admission.id,
            branchId=admission.branchId,
            name=data["name"],
            phone=data["phone"],
            relationship=data.get("relationship"),
            status="PENDING",
        )
        self.db.add(attendant)
        self.db.commit()
        self.db.refresh(attendant)
        return {"id": attendant.id, "status": attendant.status}

    def approve_attendant(self, user: dict, attendant_id: str) -> dict:
        attendant = self.db.get(Attendant, attendant_id)
        if not attendant:
            raise not_found("Attendant")
        attendant.status = "APPROVED"
        self.db.commit()
        return {"id": attendant.id, "status": attendant.status}

    def issue_pass(self, user: dict, attendant_id: str) -> dict:
        attendant = self.db.get(Attendant, attendant_id)
        if not attendant:
            raise not_found("Attendant")
        if attendant.status != "APPROVED":
            raise bad_request("Attendant must be approved before pass issuance")
        pass_row = AttendantPass(
            passNumber=self._next_pass_number(),
            attendantId=attendant.id,
            branchId=attendant.branchId,
            status="ACTIVE",
            validFrom=now_ist(),
            qrPayload=f"PASS:{attendant.id}:{now_ist().isoformat()}",
            approvedById=user.get("id"),
        )
        self.db.add(pass_row)
        self.db.commit()
        self.db.refresh(pass_row)
        return {"id": pass_row.id, "passNumber": pass_row.passNumber, "qrPayload": pass_row.qrPayload}

    def scan_pass(self, user: dict, pass_id: str, scan_type: str = "ENTRY") -> dict:
        pass_row = self.db.get(AttendantPass, pass_id)
        if not pass_row:
            raise not_found("Pass")
        self.db.add(
            AttendantPassScan(passId=pass_id, scannedById=user["id"], scanType=scan_type)
        )
        self.db.commit()
        return {"passNumber": pass_row.passNumber, "scanType": scan_type, "valid": pass_row.status == "ACTIVE"}

    def list_passes(self, branch_id: str, skip: int = 0, limit: int = 50) -> dict:
        q = self.db.query(AttendantPass).filter(AttendantPass.branchId == branch_id)
        total = q.count()
        rows = q.order_by(AttendantPass.createdAt.desc()).offset(skip).limit(limit).all()
        return {
            "total": total,
            "items": [{"id": p.id, "passNumber": p.passNumber, "status": p.status} for p in rows],
        }
