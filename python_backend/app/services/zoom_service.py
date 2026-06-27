"""Zoom Server-to-Server OAuth — create scheduled meetings for online appointments."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.config import get_settings, is_demo_mode_enabled, is_test_mode_enabled, is_zoom_configured

logger = logging.getLogger(__name__)

ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE = "https://api.zoom.us/v2"

_token_cache: dict[str, float | str] = {"expires_at": 0.0, "access_token": ""}


@dataclass(frozen=True)
class ZoomMeetingDetails:
    meeting_id: str
    join_url: str
    start_url: str
    password: str | None


class ZoomService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _mock_meeting(self, topic: str, start_time: datetime) -> ZoomMeetingDetails:
        slug = start_time.strftime("%Y%m%d%H%M")
        base = self.settings.frontend_url.rstrip("/")
        return ZoomMeetingDetails(
            meeting_id=f"mock-{slug}",
            join_url=f"{base}/book-appointment/status?mockZoom=join&topic={topic[:40]}",
            start_url=f"{base}/book-appointment/status?mockZoom=host&topic={topic[:40]}",
            password="000000",
        )

    def _get_access_token(self) -> str:
        if not is_zoom_configured(self.settings):
            raise RuntimeError(
                "Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, "
                "ZOOM_CLIENT_SECRET, and ZOOM_USER_ID."
            )

        now = time.time()
        cached = _token_cache.get("access_token")
        expires_at = float(_token_cache.get("expires_at") or 0)
        if cached and now < expires_at - 60:
            return str(cached)

        import base64

        credentials = f"{self.settings.zoom_client_id}:{self.settings.zoom_client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        response = httpx.post(
            ZOOM_TOKEN_URL,
            params={
                "grant_type": "account_credentials",
                "account_id": self.settings.zoom_account_id,
            },
            headers={"Authorization": f"Basic {encoded}"},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))
        _token_cache["access_token"] = token
        _token_cache["expires_at"] = now + expires_in
        return token

    def create_scheduled_meeting(
        self,
        *,
        topic: str,
        start_time: datetime,
        duration_minutes: int = 30,
        timezone: str = "Asia/Kolkata",
    ) -> ZoomMeetingDetails:
        if is_test_mode_enabled(self.settings) or is_demo_mode_enabled(self.settings):
            if not is_zoom_configured(self.settings):
                logger.info("[Zoom] Using mock meeting (demo/test mode, Zoom not configured)")
                return self._mock_meeting(topic, start_time)

        token = self._get_access_token()
        user_id = self.settings.zoom_user_id
        payload = {
            "topic": topic,
            "type": 2,
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration": duration_minutes,
            "timezone": timezone,
            "settings": {
                "join_before_host": True,
                "waiting_room": True,
                "approval_type": 2,
            },
        }
        response = httpx.post(
            f"{ZOOM_API_BASE}/users/{user_id}/meetings",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if response.status_code >= 400:
            logger.error("Zoom create meeting failed: %s %s", response.status_code, response.text)
            response.raise_for_status()

        data = response.json()
        return ZoomMeetingDetails(
            meeting_id=str(data.get("id", "")),
            join_url=str(data.get("join_url", "")),
            start_url=str(data.get("start_url", "")),
            password=data.get("password") or None,
        )
