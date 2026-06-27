import hashlib
import hmac
import json
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.services.zoom_webhook_service import (
    ZoomWebhookService,
    build_encrypted_token,
    build_signature_message,
    verify_webhook_signature,
)
from app.models.enums import AppointmentMode, VisitStatus
from main import app


class ZoomWebhookVerificationTests(unittest.TestCase):
    def test_build_encrypted_token(self) -> None:
        secret = "test-secret"
        plain = "abc123"
        expected = hmac.new(secret.encode(), plain.encode(), hashlib.sha256).hexdigest()
        self.assertEqual(build_encrypted_token(plain, secret), expected)

    def test_verify_webhook_signature_valid(self) -> None:
        secret = "webhook-secret"
        body = '{"event":"meeting.started"}'
        timestamp = "1710000000"
        message = build_signature_message(timestamp, body)
        digest = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        self.assertTrue(
            verify_webhook_signature(
                body=body,
                timestamp=timestamp,
                signature=f"v0={digest}",
                secret=secret,
            )
        )

    def test_verify_webhook_signature_invalid(self) -> None:
        self.assertFalse(
            verify_webhook_signature(
                body="{}",
                timestamp="1",
                signature="v0=bad",
                secret="secret",
            )
        )


class ZoomWebhookServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = MagicMock()
        self.service = ZoomWebhookService(self.db)
        self.service.notifications = MagicMock()

    @patch("app.services.zoom_webhook_service.get_settings")
    def test_url_validation_response(self, mock_settings: MagicMock) -> None:
        mock_settings.return_value.zoom_webhook_secret_token = "secret-token"
        self.service.settings = mock_settings.return_value
        result = self.service.handle_url_validation({"plainToken": "plain-abc"})
        self.assertEqual(result["plainToken"], "plain-abc")
        self.assertEqual(result["encryptedToken"], build_encrypted_token("plain-abc", "secret-token"))

    def test_meeting_started_marks_visit_checked_in(self) -> None:
        visit = MagicMock()
        visit.id = "visit-1"
        visit.status = VisitStatus.APPROVED.value
        visit.appointmentMode = AppointmentMode.ONLINE.value
        visit.visitor = MagicMock()
        visit.staff = MagicMock()
        visit.checkInTime = None
        self.db.query.return_value.options.return_value.filter.return_value.first.return_value = visit

        result = self.service._handle_meeting_started(
            {"object": {"id": 88957292084, "start_time": "2026-06-10T10:00:00Z"}}
        )

        self.assertTrue(result["handled"])
        self.assertEqual(result["action"], "checked_in")
        self.assertEqual(visit.status, VisitStatus.CHECKED_IN.value)
        self.assertEqual(visit.checkedInLocation, "ZOOM_ONLINE")
        self.service.notifications.notify_online_meeting_started.assert_called_once()

    def test_meeting_ended_marks_visit_checked_out(self) -> None:
        visit = MagicMock()
        visit.id = "visit-1"
        visit.status = VisitStatus.CHECKED_IN.value
        visit.appointmentMode = AppointmentMode.ONLINE.value
        visit.visitor = MagicMock()
        visit.staff = MagicMock()
        visit.checkInTime = datetime(2026, 6, 10, 10, 0, 0)
        visit.checkOutTime = None
        self.db.query.return_value.options.return_value.filter.return_value.first.return_value = visit

        result = self.service._handle_meeting_ended(
            {
                "object": {
                    "id": "88957292084",
                    "start_time": "2026-06-10T10:00:00Z",
                    "end_time": "2026-06-10T10:25:00Z",
                    "duration": 25,
                }
            }
        )

        self.assertTrue(result["handled"])
        self.assertEqual(result["action"], "checked_out")
        self.assertEqual(visit.status, VisitStatus.CHECKED_OUT.value)
        self.assertEqual(visit.totalDurationMinutes, 25)
        self.service.notifications.notify_online_meeting_completed.assert_called_once()


class ZoomWebhookRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    @patch("app.routers.zoom_webhooks.get_settings")
    @patch("app.services.zoom_webhook_service.get_settings")
    def test_endpoint_url_validation(self, mock_svc_settings: MagicMock, mock_route_settings: MagicMock) -> None:
        mock_svc_settings.return_value.zoom_webhook_secret_token = "secret-token"
        mock_route_settings.return_value.zoom_webhook_secret_token = "secret-token"
        body = {
            "event": "endpoint.url_validation",
            "payload": {"plainToken": "zoom-plain-token"},
        }
        response = self.client.post("/api/webhooks/zoom", json=body)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["plainToken"], "zoom-plain-token")
        self.assertEqual(
            data["encryptedToken"],
            build_encrypted_token("zoom-plain-token", "secret-token"),
        )


if __name__ == "__main__":
    unittest.main()
