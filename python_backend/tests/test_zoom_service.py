import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.services.zoom_service import ZoomMeetingDetails, ZoomService


class ZoomServiceTests(unittest.TestCase):
    @patch("app.services.zoom_service.is_zoom_configured", return_value=False)
    @patch("app.services.zoom_service.is_demo_mode_enabled", return_value=True)
    @patch("app.services.zoom_service.is_test_mode_enabled", return_value=False)
    @patch("app.services.zoom_service.get_settings")
    def test_mock_meeting_in_demo_mode(
        self,
        mock_settings: MagicMock,
        _test_mode: MagicMock,
        _demo_mode: MagicMock,
        _zoom_configured: MagicMock,
    ) -> None:
        mock_settings.return_value.frontend_url = "http://localhost:3000"
        service = ZoomService()
        start = datetime(2026, 6, 10, 10, 0, 0)
        result = service.create_scheduled_meeting(topic="Online consultation — Test", start_time=start)

        self.assertIsInstance(result, ZoomMeetingDetails)
        self.assertTrue(result.meeting_id.startswith("mock-"))
        self.assertIn("mockZoom=join", result.join_url)
        self.assertIn("mockZoom=host", result.start_url)

    @patch("app.services.zoom_service.is_zoom_configured", return_value=True)
    @patch("app.services.zoom_service.is_demo_mode_enabled", return_value=False)
    @patch("app.services.zoom_service.is_test_mode_enabled", return_value=False)
    @patch("app.services.zoom_service.httpx.post")
    @patch("app.services.zoom_service.get_settings")
    def test_create_meeting_calls_zoom_api(
        self,
        mock_settings: MagicMock,
        mock_post: MagicMock,
        _test_mode: MagicMock,
        _demo_mode: MagicMock,
        _zoom_configured: MagicMock,
    ) -> None:
        mock_settings.return_value.zoom_client_id = "client-id"
        mock_settings.return_value.zoom_client_secret = "client-secret"
        mock_settings.return_value.zoom_account_id = "account-id"
        mock_settings.return_value.zoom_user_id = "host@hospital.com"

        token_response = MagicMock()
        token_response.raise_for_status.return_value = None
        token_response.json.return_value = {"access_token": "token-abc", "expires_in": 3600}

        meeting_response = MagicMock()
        meeting_response.status_code = 201
        meeting_response.json.return_value = {
            "id": 987654321,
            "join_url": "https://zoom.us/j/987654321",
            "start_url": "https://zoom.us/s/987654321",
            "password": "abc123",
        }
        mock_post.side_effect = [token_response, meeting_response]

        service = ZoomService()
        start = datetime(2026, 6, 10, 10, 0, 0)
        result = service.create_scheduled_meeting(topic="Online consultation", start_time=start)

        self.assertEqual(result.meeting_id, "987654321")
        self.assertEqual(result.join_url, "https://zoom.us/j/987654321")
        self.assertEqual(result.start_url, "https://zoom.us/s/987654321")
        self.assertEqual(result.password, "abc123")

        meeting_call = mock_post.call_args_list[1]
        payload = meeting_call.kwargs["json"]
        self.assertEqual(payload["type"], 2)
        self.assertEqual(payload["timezone"], "Asia/Kolkata")
        self.assertEqual(payload["topic"], "Online consultation")
        self.assertEqual(payload["start_time"], "2026-06-10T10:00:00")


if __name__ == "__main__":
    unittest.main()
