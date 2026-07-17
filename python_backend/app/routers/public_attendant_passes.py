"""Public attendant pass apply + admission lookup (no auth)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.attendant.pass_service import AttendantPassService
from app.database import get_db

router = APIRouter()


class PublicApplyBody(BaseModel):
    admissionId: str
    name: str
    email: EmailStr
    phone: str
    relationship: str | None = None


@router.get("/admissions/lookup")
def lookup_admission(
    db: Annotated[Session, Depends(get_db)],
    branchId: str = Query(...),
    mrn: str = Query(...),
):
    return AttendantPassService(db).lookup_admission_by_mrn(branchId, mrn)


@router.post("/apply", status_code=201)
def public_apply(
    body: PublicApplyBody,
    db: Annotated[Session, Depends(get_db)],
):
    return AttendantPassService(db).public_apply(body.model_dump())
