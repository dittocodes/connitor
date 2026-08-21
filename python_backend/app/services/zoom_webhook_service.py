"""Zoom webhook signature verification and online visit lifecycle updates."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models import Visit
from app.models.enums import AppointmentMode, VisitStatus
from app.services.notifications_service import NotificationsService
from app.utils.timezone import now_ist

logger = logging.getLogger(__name__)


def build_encrypted_token(plain_token: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), plain_token.encode("utf-8"), hashlib.sha256).hexdigest()


def build_signature_message(timestamp: str, body: str) -> str:
    return f"v0:{timestamp}:{body}"


def verify_webhook_signature(
    *,
    body: str,
    timestamp: str | None,
    signature: str | None,
    secret: str,
) -> bool:
    if not timestamp or not signature:
        return False
    message = build_signature_message(timestamp, body)
    expected = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, f"v0={expected}")


def parse_zoom_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        from app.utils.timezone import IST

        parsed = parsed.astimezone(IST).replace(tzinfo=None)
    return parsed


class ZoomWebhookService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsService(db)
        self.settings = get_settings()

    def handle_url_validation(self, payload: dict[str, Any]) -> dict[str, str]:
        secret = self.settings.zoom_webhook_secret_token
        if not secret:
            raise ValueError("ZOOM_WEBHOOK_SECRET_TOKEN is not configured.")
        plain_token = str(payload.get("plainToken", ""))
        if not plain_token:
            raise ValueError("Missing plainToken in validation payload.")
        return {
            "plainToken": plain_token,
            "encryptedToken": build_encrypted_token(plain_token, secret),
        }

    def handle_event(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        if event == "meeting.started":
            return self._handle_meeting_started(payload)
        if event == "meeting.ended":
            return self._handle_meeting_ended(payload)
        logger.info("Ignoring unhandled Zoom webhook event: %s", event)
        return {"handled": False, "event": event}

    def _meeting_id_from_payload(self, payload: dict[str, Any]) -> str | None:
        obj = payload.get("object") or {}
        meeting_id = obj.get("id")
        if meeting_id is None:
            return None
        return str(meeting_id)

    def _find_online_visit(self, meeting_id: str) -> Visit | None:
        return (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.staff))
            .filter(
                Visit.zoomMeetingId == meeting_id,
                Visit.appointmentMode == AppointmentMode.ONLINE.value,
            )
            .first()
        )

    def _handle_meeting_started(self, payload: dict[str, Any]) -> dict[str, Any]:
        meeting_id = self._meeting_id_from_payload(payload)
        if not meeting_id:
            return {"handled": False, "reason": "missing_meeting_id"}

        visit = self._find_online_visit(meeting_id)
        if not visit:
            logger.info("No online visit found for Zoom meeting %s", meeting_id)
            return {"handled": False, "reason": "visit_not_found", "meetingId": meeting_id}

        if visit.status == VisitStatus.CHECKED_IN.value:
            return {"handled": True, "visitId": visit.id, "action": "already_checked_in"}

        if visit.status not in (VisitStatus.APPROVED.value, VisitStatus.REQUEST_SENT.value):
            return {
                "handled": False,
                "reason": "invalid_status",
                "visitId": visit.id,
                "status": visit.status,
            }

        obj = payload.get("object") or {}
        check_in_time = parse_zoom_datetime(obj.get("start_time")) or now_ist()
        visit.status = VisitStatus.CHECKED_IN.value
        visit.checkInTime = check_in_time
        visit.checkedInLocation = "ZOOM_ONLINE"
        self.db.commit()

        if visit.visitor and visit.staff:
            self.notifications.notify_online_meeting_started(visit, visit.visitor, visit.staff)

        logger.info("Online visit %s marked CHECKED_IN from Zoom meeting.started", visit.id)
        return {"handled": True, "visitId": visit.id, "action": "checked_in"}

    def _handle_meeting_ended(self, payload: dict[str, Any]) -> dict[str, Any]:
        meeting_id = self._meeting_id_from_payload(payload)
        if not meeting_id:
            return {"handled": False, "reason": "missing_meeting_id"}

        visit = self._find_online_visit(meeting_id)
        if not visit:
            logger.info("No online visit found for ended Zoom meeting %s", meeting_id)
            return {"handled": False, "reason": "visit_not_found", "meetingId": meeting_id}

        if visit.status == VisitStatus.CHECKED_OUT.value:
            return {"handled": True, "visitId": visit.id, "action": "already_checked_out"}

        obj = payload.get("object") or {}
        check_out_time = parse_zoom_datetime(obj.get("end_time")) or now_ist()

        if visit.status == VisitStatus.APPROVED.value and not visit.checkInTime:
            visit.checkInTime = parse_zoom_datetime(obj.get("start_time")) or check_out_time
            visit.checkedInLocation = "ZOOM_ONLINE"

        if not visit.checkInTime:
            visit.checkInTime = check_out_time

        duration: int | None = None
        zoom_duration = obj.get("duration")
        if isinstance(zoom_duration, int) and zoom_duration > 0:
            duration = zoom_duration
        elif visit.checkInTime:
            duration = max(1, int((check_out_time - visit.checkInTime).total_seconds() / 60))

        visit.status = VisitStatus.CHECKED_OUT.value
        visit.checkOutTime = check_out_time
        visit.durationMinutes = duration
        visit.totalDurationMinutes = duration
        self.db.commit()

        if visit.visitor:
            self.notifications.notify_online_meeting_completed(
                visit, visit.visitor, visit.staff, duration
            )

        logger.info("Online visit %s marked CHECKED_OUT from Zoom meeting.ended", visit.id)
        return {
            "handled": True,
            "visitId": visit.id,
            "action": "checked_out",
            "durationMinutes": duration,
        }
