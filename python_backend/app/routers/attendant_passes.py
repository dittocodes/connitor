"""Attendant pass API routes (staff)."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.attendant.pass_service import AttendantPassService
from app.database import get_db
from app.dependencies.permissions import require_permission

router = APIRouter()


class PatientBody(BaseModel):
    branchId: str | None = None
    mrn: str
    firstName: str
    lastName: str
    phone: str | None = None


class AdmissionBody(BaseModel):
    patientId: str
    branchId: str | None = None
    wardName: str | None = None
    roomNumber: str | None = None
    bedNumber: str | None = None


class AttendantBody(BaseModel):
    admissionId: str
    name: str
    email: EmailStr
    phone: str
    relationship: str | None = None


class IssuePassBody(BaseModel):
    revokeExisting: bool = False


@router.post("/patients", status_code=201)
def create_patient(
    body: PatientBody,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).create_patient(user, body.model_dump())


@router.post("/admissions", status_code=201)
def create_admission(
    body: AdmissionBody,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).create_admission(user, body.model_dump())


@router.get("/admissions")
def list_admissions(
    user: Annotated[dict, Depends(require_permission("VIEW_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return AttendantPassService(db).list_admissions(branchId, skip, limit)


@router.post("/attendants", status_code=201)
def register_attendant(
    body: AttendantBody,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).register_attendant(user, body.model_dump())


@router.get("/attendants")
def list_attendants(
    user: Annotated[dict, Depends(require_permission("VIEW_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str = Query(...),
    admissionId: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return AttendantPassService(db).list_attendants(
        branchId, admission_id=admissionId, skip=skip, limit=limit
    )


@router.post("/attendants/{attendant_id}/approve")
def approve_attendant(
    attendant_id: str,
    user: Annotated[dict, Depends(require_permission("APPROVE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).approve_attendant(user, attendant_id)


@router.get("/passes")
def list_passes(
    user: Annotated[dict, Depends(require_permission("VIEW_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return AttendantPassService(db).list_passes(branchId, skip, limit)


@router.post("/passes/{attendant_id}/issue", status_code=201)
def issue_pass(
    attendant_id: str,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
    body: IssuePassBody | None = None,
):
    revoke = body.revokeExisting if body else False
    return AttendantPassService(db).issue_pass(user, attendant_id, revoke_existing=revoke)


@router.post("/passes/{pass_id}/revoke")
def revoke_pass(
    pass_id: str,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).revoke_pass(user, pass_id)


@router.post("/passes/scan")
async def scan_pass(
    user: Annotated[dict, Depends(require_permission("SCAN_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
    qrPayload: Annotated[str, Form(...)],
    signature: Annotated[str, Form(...)],
    govtIdImage: Annotated[UploadFile, File(...)],
    scanType: Annotated[str, Form()] = "ENTRY",
    govtIdType: Annotated[str | None, Form()] = None,
):
    return await AttendantPassService(db).scan_pass(
        user,
        qr_payload=qrPayload,
        signature=signature,
        govt_id_file=govtIdImage,
        scan_type=scanType,
        govt_id_type=govtIdType,
    )
