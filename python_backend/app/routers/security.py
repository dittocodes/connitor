from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.enums import Role
from app.services.security_service import SecurityService

router = APIRouter(
    dependencies=[Depends(get_current_user), Depends(require_roles(Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value))]
)


class RejectBody(BaseModel):
    rejectionReason: str


@router.patch("/visits/{visit_id}/approve")
def approve_visit(visit_id: str, user: Annotated[dict, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    return SecurityService(db).approve_visit(visit_id, user)


@router.patch("/visits/{visit_id}/reject")
def reject_visit(
    visit_id: str, body: RejectBody, user: Annotated[dict, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]
):
    return SecurityService(db).reject_visit(visit_id, user, body.rejectionReason)


@router.get("/visitors/counts")
def visitor_counts(
    branchId: str = Query(...),
    user: Annotated[dict, Depends(get_current_user)] = ...,
    db: Session = Depends(get_db),
):
    return SecurityService(db).get_visitor_counts(branchId, user)


@router.get("/visitors")
def visitors_by_status(
    branchId: str = Query(...),
    status: list[str] = Query(default=[]),
    user: Annotated[dict, Depends(get_current_user)] = ...,
    db: Session = Depends(get_db),
):
    return SecurityService(db).get_visitors_by_status(branchId, status, user)


@router.get("/visits/{visit_id}/details")
def visit_details(visit_id: str, user: Annotated[dict, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    return SecurityService(db).get_visitor_details(visit_id, user)
