"""Attendant pass API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.attendant.pass_service import AttendantPassService
from app.database import get_db
from app.dependencies.permissions import require_permission

router = APIRouter()


class PatientBody(BaseModel):
    branchId: str
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
    phone: str
    relationship: str | None = None


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


@router.post("/attendants", status_code=201)
def register_attendant(
    body: AttendantBody,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).register_attendant(user, body.model_dump())


@router.post("/attendants/{attendant_id}/approve")
def approve_attendant(
    attendant_id: str,
    user: Annotated[dict, Depends(require_permission("MANAGE_ATTENDANT_PASS"))],
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
):
    return AttendantPassService(db).issue_pass(user, attendant_id)


@router.post("/passes/{pass_id}/scan")
def scan_pass(
    pass_id: str,
    user: Annotated[dict, Depends(require_permission("SCAN_ATTENDANT_PASS"))],
    db: Annotated[Session, Depends(get_db)],
    scanType: str = Query("ENTRY"),
):
    return AttendantPassService(db).scan_pass(user, pass_id, scanType)
