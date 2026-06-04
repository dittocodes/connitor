import base64
import io
import json
import random
from datetime import datetime

import qrcode
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Visit
from app.models.enums import VisitStatus
from app.services.notifications_service import NotificationsService
from app.utils.serializers import model_to_dict


class StaffService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsService(db)

    def get_pending_visits(self, staff_id: str) -> list[dict]:
        visits = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor))
            .filter(Visit.staffId == staff_id, Visit.status == VisitStatus.REQUEST_SENT.value)
            .order_by(Visit.createdAt.asc())
            .all()
        )
        return [self._visit_with_visitor(v) for v in visits]

    def get_visitor_history(self, staff_id: str) -> list[dict]:
        statuses = [
            VisitStatus.APPROVED.value,
            VisitStatus.REJECTED.value,
            VisitStatus.CHECKED_IN.value,
            VisitStatus.CHECKED_OUT.value,
        ]
        visits = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor))
            .filter(Visit.staffId == staff_id, Visit.status.in_(statuses))
            .order_by(Visit.createdAt.desc())
            .all()
        )
        return [self._visit_with_visitor(v) for v in visits]

    def _visit_with_visitor(self, visit: Visit) -> dict:
        data = model_to_dict(visit)
        if visit.visitor:
            data["visitor"] = {
                "firstName": visit.visitor.firstName,
                "lastName": visit.visitor.lastName,
                "phone": visit.visitor.phone,
            }
        return data

    def _generate_qr_base64(self, visit: Visit, visit_code: str) -> str:
        payload = {
            "visitId": visit.id,
            "visitorName": f"{visit.visitor.firstName} {visit.visitor.lastName}",
            "visitorPhone": visit.visitor.phone,
            "purpose": visit.purpose,
            "staffName": visit.staffName,
            "visitCode": visit_code,
            "timestamp": datetime.utcnow().isoformat(),
        }
        img = qrcode.make(json.dumps(payload))
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()

    def approve_visit(self, visit_id: str, staff_id: str) -> dict:
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.staff))
            .filter(Visit.id == visit_id)
            .first()
        )
        if not visit:
            raise HTTPException(status_code=404, detail="Visit request not found.")
        if visit.staffId != staff_id:
            raise HTTPException(status_code=403, detail="You are not authorized to approve this visit.")
        if visit.status != VisitStatus.REQUEST_SENT.value:
            raise HTTPException(status_code=409, detail=f"This visit is already in '{visit.status}' status.")

        visit_code = f"{random.randint(100000, 999999)}"
        pamphlet = self._generate_qr_base64(visit, visit_code)
        visit.status = VisitStatus.APPROVED.value
        visit.visitCode = visit_code
        visit.visitQRCode = pamphlet
        self.db.commit()
        self.db.refresh(visit)

        if visit.staff and visit.visitor:
            self.notifications.notify_security_on_visit_approval(visit, visit.staff, visit.visitor)

        return {
            "message": "Visitor request approved successfully.",
            "visit": model_to_dict(visit),
            "pamphletImage": pamphlet,
        }

    def reject_visit(self, visit_id: str, staff_id: str, rejection_reason: str) -> dict:
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.staff))
            .filter(Visit.id == visit_id)
            .first()
        )
        if not visit:
            raise HTTPException(status_code=404, detail="Visit request not found.")
        if visit.staffId != staff_id:
            raise HTTPException(status_code=403, detail="You are not authorized to reject this visit.")
        if visit.status != VisitStatus.REQUEST_SENT.value:
            raise HTTPException(
                status_code=409,
                detail=f"This visit is already in '{visit.status}' status and cannot be rejected.",
            )
        visit.status = VisitStatus.REJECTED.value
        visit.rejectionReason = rejection_reason
        self.db.commit()
        self.db.refresh(visit)
        return {"message": "Visitor request rejected successfully.", "visit": model_to_dict(visit)}
