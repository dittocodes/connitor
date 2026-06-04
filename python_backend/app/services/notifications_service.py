from sqlalchemy.orm import Session

from app.models import Notification, User, Visit, Visitor
from app.models.enums import Role


class NotificationsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _visitor_name(self, visitor: Visitor) -> str:
        middle = f" {visitor.middleName}" if visitor.middleName else ""
        return f"{visitor.firstName}{middle} {visitor.lastName}"

    def notify_staff_on_visit_request(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        self.db.add(
            Notification(
                recipientId=staff.id,
                visitId=visit.id,
                message=f"You have a new visit request from {self._visitor_name(visitor)}. Please review.",
            )
        )
        self.db.commit()

    def notify_security_on_new_visit_request(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        security_users = (
            self.db.query(User)
            .filter(
                User.branchId == visit.branchId,
                User.role.in_([Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value]),
                User.isActive == True,  # noqa: E712
            )
            .all()
        )
        for security in security_users:
            self.db.add(
                Notification(
                    recipientId=security.id,
                    visitId=visit.id,
                    message=(
                        f"New visit request from {self._visitor_name(visitor)} to meet {staff.name}. "
                        "Status: Pending staff approval."
                    ),
                )
            )
        self.db.commit()

    def notify_security_on_visit_approval(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        security_users = (
            self.db.query(User)
            .filter(
                User.branchId == visit.branchId,
                User.role.in_([Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value]),
                User.isActive == True,  # noqa: E712
            )
            .all()
        )
        for security in security_users:
            self.db.add(
                Notification(
                    recipientId=security.id,
                    visitId=visit.id,
                    message=(
                        f"Visit for {self._visitor_name(visitor)} to meet {staff.name} "
                        "has been approved. Please prepare for check-in."
                    ),
                )
            )
        self.db.commit()

    def notify_staff_on_check_in(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        self.db.add(
            Notification(
                recipientId=staff.id,
                visitId=visit.id,
                message=f"Your visitor, {self._visitor_name(visitor)}, has checked in and is on their way.",
            )
        )
        self.db.commit()

    def notify_staff_on_security_approval(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        self.db.add(
            Notification(
                recipientId=staff.id,
                visitId=visit.id,
                message=f"Security has approved the visit for {self._visitor_name(visitor)}.",
            )
        )
        self.db.commit()

    def notify_staff_on_security_rejection(
        self, visit: Visit, staff: User, visitor: Visitor, rejection_reason: str
    ) -> None:
        self.db.add(
            Notification(
                recipientId=staff.id,
                visitId=visit.id,
                message=(
                    f"Security has rejected the visit for {self._visitor_name(visitor)}. "
                    f"Reason: {rejection_reason}"
                ),
            )
        )
        self.db.commit()

    def get_unread_notifications(self, user_id: str) -> list[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.recipientId == user_id, Notification.read == False)  # noqa: E712
            .order_by(Notification.createdAt.desc())
            .all()
        )

    def mark_as_read(self, notification_id: str, user_id: str) -> Notification:
        from fastapi import HTTPException

        notification = (
            self.db.query(Notification)
            .filter(Notification.id == notification_id, Notification.recipientId == user_id)
            .first()
        )
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found or access denied.")
        notification.read = True
        self.db.commit()
        self.db.refresh(notification)
        return notification
