from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import public_route
from app.services.visit_approval_link_service import VisitApprovalLinkService

router = APIRouter()


class TokenBody(BaseModel):
    token: str = Field(min_length=16)


class RejectViaLinkBody(BaseModel):
    token: str = Field(min_length=16)
    reason: str = Field(default="Declined via approval link", max_length=500)


@router.get("/preview")
@public_route
def preview_approval(token: str = Query(..., min_length=16), db: Session = Depends(get_db)):
    return VisitApprovalLinkService(db).get_preview(token)


@router.post("/approve")
@public_route
def approve_via_link(body: TokenBody, db: Annotated[Session, Depends(get_db)]):
    try:
        return VisitApprovalLinkService(db).approve(body.token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not approve appointment.") from exc


@router.post("/reject")
@public_route
def reject_via_link(body: RejectViaLinkBody, db: Annotated[Session, Depends(get_db)]):
    return VisitApprovalLinkService(db).reject(body.token, body.reason)
