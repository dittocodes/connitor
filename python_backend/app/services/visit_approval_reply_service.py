"""Shared doctor YES/NO reply handling for SMS and WhatsApp webhooks."""

from __future__ import annotations

import logging
import re

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import User, Visit
from app.models.enums import Role, VisitStatus
from app.services.staff_service import StaffService
from app.utils.phone import normalize_phone, phones_match, strip_channel_prefix

logger = logging.getLogger(__name__)

REPLY_PATTERN = re.compile(r"^(YES|NO|Y|N)\s*(\d{6})$", re.IGNORECASE)
ACTION_ONLY_PATTERN = re.compile(r"^(YES|NO|Y|N)$", re.IGNORECASE)
BUTTON_ID_PATTERN = re.compile(r"^(yes|no)_(\d{6})$", re.IGNORECASE)

REJECT_REASON = "Declined via WhatsApp"


def parse_approval_reply(body: str) -> tuple[str, str | None] | None:
    text = body.strip()
    match = REPLY_PATTERN.match(text)
    if match:
        keyword = match.group(1).upper()
        action = "approve" if keyword in ("YES", "Y") else "reject"
        return action, match.group(2)

    match = ACTION_ONLY_PATTERN.match(text)
    if match:
        keyword = match.group(1).upper()
        action = "approve" if keyword in ("YES", "Y") else "reject"
        return action, None

    return None


def parse_button_reply(button_id: str) -> tuple[str, str] | None:
    """Parse Meta WhatsApp button id: yes_482901 or no_482901."""
    match = BUTTON_ID_PATTERN.match(button_id.strip())
    if not match:
        return None
    action = "approve" if match.group(1).lower() == "yes" else "reject"
    return action, match.group(2)


class VisitApprovalReplyService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.staff_service = StaffService(db)

    def _find_doctor_by_phone(self, from_phone: str) -> User | None:
        normalized_from = normalize_phone(strip_channel_prefix(from_phone))
        candidates = (
            self.db.query(User)
            .filter(
                User.role == Role.STAFF.value,
                User.isActive == True,  # noqa: E712
            )
            .all()
        )
        for user in candidates:
            if user.phone and phones_match(user.phone, normalized_from):
                return user
        return None

    def _find_pending_visit(self, doctor: User, *, code: str | None) -> Visit | None:
        if code:
            return (
                self.db.query(Visit)
                .options(joinedload(Visit.visitor))
                .filter(
                    Visit.smsApprovalCode == code,
                    Visit.staffId == doctor.id,
                    Visit.status == VisitStatus.REQUEST_SENT.value,
                )
                .first()
            )

        pending = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor))
            .filter(
                Visit.staffId == doctor.id,
                Visit.status == VisitStatus.REQUEST_SENT.value,
            )
            .order_by(Visit.createdAt.asc())
            .all()
        )
        if len(pending) == 1:
            return pending[0]
        return None

    def _process_action(
        self,
        *,
        from_phone: str,
        action: str,
        code: str | None,
    ) -> str:
        doctor = self._find_doctor_by_phone(from_phone)
        if not doctor:
            logger.warning("Approval reply from unknown phone: %s", from_phone)
            return "This number is not registered as a doctor in Connitor."

        visit = self._find_pending_visit(doctor, code=code)
        if not visit:
            if code:
                return (
                    f"No pending appointment found for code {code}. "
                    "Check the code in your WhatsApp or use My Visitors."
                )
            return (
                "You have multiple pending requests. Use the Yes/No buttons on the "
                "appointment message, or reply YES {code} / NO {code}."
            )

        try:
            if action == "approve":
                self.staff_service.approve_visit(visit.id, doctor.id)
                visitor_name = "the visitor"
                if visit.visitor:
                    visitor_name = f"{visit.visitor.firstName} {visit.visitor.lastName}".strip()
                return f"Approved. {visitor_name} has been notified with appointment details."

            self.staff_service.reject_visit(visit.id, doctor.id, REJECT_REASON)
            return "Rejected. The visitor has been notified."
        except HTTPException as exc:
            if exc.status_code == 409:
                return "This appointment was already processed."
            if exc.status_code == 404:
                return "Appointment not found. It may have been cancelled."
            if exc.status_code == 403:
                return "You are not authorized to act on this appointment."
            logger.exception("Approval reply failed for visit %s: %s", visit.id, exc.detail)
            return "Could not process your reply. Please use My Visitors in the app."
        except Exception:
            logger.exception("Approval reply unexpected error for visit %s", visit.id)
            return "Something went wrong. Please try again or use My Visitors."

    def handle_button_reply(self, *, from_phone: str, button_id: str) -> str:
        parsed = parse_button_reply(button_id)
        if not parsed:
            return "Unrecognized button. Use Yes or No on the appointment message."
        action, code = parsed
        return self._process_action(from_phone=from_phone, action=action, code=code)

    def handle_reply(self, *, from_phone: str, body: str) -> str:
        parsed = parse_approval_reply(body)
        if not parsed:
            return (
                "Unrecognized reply. Tap Yes or No on the appointment message, "
                "or send YES {code} / NO {code}."
            )

        action, code = parsed
        return self._process_action(from_phone=from_phone, action=action, code=code)
