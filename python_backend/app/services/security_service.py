from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models import User, Visit
from app.models.enums import Role, VisitStatus
from app.services.gate_pass_service import GatePassService
from app.services.notifications_service import NotificationsService
from app.utils.serializers import model_to_dict


class SecurityService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsService(db)
        self.gate_pass = GatePassService(db)

    def _assert_access(self, user: dict, branch_id: str | None = None) -> None:
        if user["role"] not in (Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value):
            raise HTTPException(status_code=403, detail="You are not authorized to perform this action.")
        if branch_id and user.get("branchId") != branch_id:
            raise HTTPException(status_code=403, detail="You can only access visitor data for your assigned branch.")

    def approve_visit(self, visit_id: str, user: dict) -> dict:
        self._assert_access(user)
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.staff), joinedload(Visit.visitor))
            .filter(Visit.id == visit_id, Visit.branchId == user.get("branchId"))
            .first()
        )
        if not visit:
            raise HTTPException(status_code=404, detail="Visit request not found at this branch.")
        if visit.status != VisitStatus.REQUEST_SENT.value:
            raise HTTPException(status_code=409, detail=f"This visit is already in '{visit.status}' status.")

        self.gate_pass.generate_check_in_otp(visit_id)
        image = self.gate_pass.generate_gate_pass_image(visit_id)
        gcp = self.gate_pass.upload_gate_pass_to_gcp(visit_id, image["imageUrl"])
        whatsapp = self.gate_pass.send_gate_pass_via_whatsapp(visit_id, image["imageUrl"])

        visit.status = VisitStatus.APPROVED.value
        self.db.commit()
        self.db.refresh(visit)

        if visit.staff:
            self.notifications.notify_staff_on_security_approval(visit, visit.staff, visit.visitor)

        return {
            "message": "Visitor request approved successfully by Security.",
            "visit": model_to_dict(visit),
            "gatePassUrl": gcp["publicUrl"],
            "gatePassUrlExpiry": gcp["urlExpiry"].isoformat(),
            "whatsappSent": whatsapp["sent"],
        }

    def reject_visit(self, visit_id: str, user: dict, rejection_reason: str) -> dict:
        self._assert_access(user)
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.staff), joinedload(Visit.visitor))
            .filter(Visit.id == visit_id, Visit.branchId == user.get("branchId"))
            .first()
        )
        if not visit:
            raise HTTPException(status_code=404, detail="Visit request not found at this branch.")
        if visit.status != VisitStatus.REQUEST_SENT.value:
            raise HTTPException(
                status_code=409,
                detail=f"This visit is already in '{visit.status}' status and cannot be rejected.",
            )
        visit.status = VisitStatus.REJECTED.value
        visit.rejectionReason = rejection_reason
        self.db.commit()
        if visit.staff:
            self.notifications.notify_staff_on_security_rejection(
                visit, visit.staff, visit.visitor, rejection_reason
            )
        return {"message": "Visitor request rejected successfully by Security.", "visit": model_to_dict(visit)}

    def get_visitor_counts(self, branch_id: str, user: dict) -> dict:
        self._assert_access(user, branch_id)
        result = {"pending": 0, "approved": 0, "checkedIn": 0, "checkedOut": 0, "rejected": 0}
        rows = (
            self.db.query(Visit.status)
            .filter(
                Visit.branchId == branch_id,
                Visit.status.in_(
                    [
                        VisitStatus.PENDING.value,
                        VisitStatus.REQUEST_SENT.value,
                        VisitStatus.APPROVED.value,
                        VisitStatus.CHECKED_IN.value,
                        VisitStatus.CHECKED_OUT.value,
                        VisitStatus.REJECTED.value,
                    ]
                ),
            )
            .all()
        )
        for (status,) in rows:
            if status in (VisitStatus.PENDING.value, VisitStatus.REQUEST_SENT.value):
                result["pending"] += 1
            elif status == VisitStatus.APPROVED.value:
                result["approved"] += 1
            elif status == VisitStatus.CHECKED_IN.value:
                result["checkedIn"] += 1
            elif status == VisitStatus.CHECKED_OUT.value:
                result["checkedOut"] += 1
            elif status == VisitStatus.REJECTED.value:
                result["rejected"] += 1
        return result

    def get_visitors_by_status(self, branch_id: str, statuses: list[str], user: dict) -> dict:
        self._assert_access(user, branch_id)
        visits = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.staff))
            .filter(Visit.branchId == branch_id, Visit.status.in_(statuses))
            .order_by(Visit.createdAt.desc())
            .all()
        )
        visitors = []
        for visit in visits:
            middle = f" {visit.visitor.middleName}" if visit.visitor.middleName else ""
            visitors.append(
                {
                    "id": visit.id,
                    "visitorName": f"{visit.visitor.firstName}{middle} {visit.visitor.lastName}".strip(),
                    "visitorPhone": visit.visitor.phone,
                    "visitorEmail": visit.visitor.email,
                    "visitorPhoto": visit.visitor.photo,
                    "visitType": visit.visitCategory,
                    "status": visit.status,
                    "personToMeet": visit.staff.name if visit.staff else visit.staffName,
                    "purpose": visit.purpose,
                    "checkInTime": visit.checkInTime.isoformat() if visit.checkInTime else None,
                    "checkOutTime": visit.checkOutTime.isoformat() if visit.checkOutTime else None,
                }
            )
        return {"visitors": visitors, "totalCount": len(visitors)}

    def get_visitor_details(self, visit_id: str, user: dict) -> dict:
        if user["role"] not in (
            Role.SECURITY.value,
            Role.SECURITY_SUPERVISOR.value,
            Role.SUPER_ADMIN.value,
        ):
            raise HTTPException(status_code=403, detail="You are not authorized to perform this action.")
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.branch), joinedload(Visit.staff))
            .filter(Visit.id == visit_id)
            .first()
        )
        if not visit:
            raise HTTPException(status_code=404, detail="Visit not found")
        if user["role"] != Role.SUPER_ADMIN.value and user.get("branchId") != visit.branchId:
            raise HTTPException(status_code=403, detail="You do not have access to this branch")

        settings = get_settings()
        photo_url = visit.visitor.photo
        if photo_url and not photo_url.startswith("http") and settings.gcp_public_url:
            photo_url = f"{settings.gcp_public_url}/photos/{photo_url}"

        approved_at = None
        if visit.status in (
            VisitStatus.APPROVED.value,
            VisitStatus.CHECKED_IN.value,
            VisitStatus.CHECKED_OUT.value,
        ):
            approved_at = visit.updatedAt.isoformat()

        return {
            "success": True,
            "data": {
                "id": visit.visitor.id,
                "visitId": visit.id,
                "firstName": visit.visitor.firstName,
                "lastName": visit.visitor.lastName,
                "fullName": f"{visit.visitor.firstName} {visit.visitor.lastName}",
                "phone": visit.visitor.phone,
                "email": visit.visitor.email,
                "company": visit.visitor.company,
                "designation": visit.visitor.designation,
                "photoUrl": photo_url,
                "visitType": visit.visitCategory,
                "status": visit.status,
                "purpose": visit.purpose,
                "hostName": visit.staffName,
                "department": visit.department,
                "staffPhone": visit.staffPhone,
                "createdAt": visit.createdAt.isoformat(),
                "approvedAt": approved_at,
                "checkedInAt": visit.checkInTime.isoformat() if visit.checkInTime else None,
                "checkedOutAt": visit.checkOutTime.isoformat() if visit.checkOutTime else None,
                "checkInOtp": visit.checkInOtp,
                "checkInOtpExpiry": visit.checkInOtpExpiry.isoformat() if visit.checkInOtpExpiry else None,
                "gatePassGeneratedAt": visit.gatePassGeneratedAt.isoformat()
                if visit.gatePassGeneratedAt
                else None,
            },
        }
