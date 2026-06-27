import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.models.enums import AppointmentMode, VisitStatus
from app.services.staff_service import StaffService
from app.services.zoom_service import ZoomMeetingDetails


def _online_visit() -> MagicMock:
    visit = MagicMock()
    visit.id = "visit-online-1"
    visit.staffId = "doc-1"
    visit.status = VisitStatus.REQUEST_SENT.value
    visit.appointmentMode = AppointmentMode.ONLINE.value
    visit.appointmentDate = datetime(2026, 6, 10, 10, 0, 0)
    visit.staffName = "Dr. Arjun"
    visit.visitor.firstName = "Rahul"
    visit.visitor.lastName = "Mehta"
    visit.staff.id = "doc-1"
    visit.staff.name = "Dr. Arjun Desai"
    visit.staff.email = "arjun@hospital.com"
    visit.staff.phone = "7003636111"
    visit.visitor.email = "rahul@example.com"
    visit.visitor.phone = "9123456701"
    return visit


class OnlineApprovalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = MagicMock()
        self.service = StaffService(self.db)
        self.service.notifications = MagicMock()

    @patch("app.services.staff_service.ZoomService")
    @patch("app.services.staff_service.model_to_dict", return_value={"id": "visit-online-1"})
    def test_approve_online_creates_zoom_and_skips_qr(
        self,
        _mock_serialize: MagicMock,
        mock_zoom_cls: MagicMock,
    ) -> None:
        visit = _online_visit()
        self.db.query.return_value.options.return_value.filter.return_value.first.return_value = visit

        mock_zoom_cls.return_value.create_scheduled_meeting.return_value = ZoomMeetingDetails(
            meeting_id="123456789",
            join_url="https://zoom.us/j/123456789",
            start_url="https://zoom.us/s/123456789",
            password="pass123",
        )

        result = self.service.approve_visit("visit-online-1", "doc-1")

        self.assertEqual(result["message"], "Visitor request approved successfully.")
        self.assertNotIn("pamphletImage", result)
        self.assertEqual(visit.status, VisitStatus.APPROVED.value)
        self.assertEqual(visit.zoomMeetingId, "123456789")
        self.assertEqual(visit.zoomJoinUrl, "https://zoom.us/j/123456789")
        self.assertEqual(visit.zoomStartUrl, "https://zoom.us/s/123456789")
        self.assertIsNone(visit.visitQRCode)
        self.assertIsNone(visit.checkInOtp)

        self.service.notifications.notify_admins_on_doctor_approval.assert_called_once()
        self.service.notifications.notify_doctor_online_approval.assert_called_once()
        self.service.notifications.notify_visitor_online_approval.assert_called_once()
        self.service.notifications.notify_staff_on_approval.assert_not_called()
        self.service.notifications.notify_visitor_approval.assert_not_called()

    @patch("app.services.staff_service.StaffService._generate_qr_base64", return_value="data:image/png;base64,abc")
    @patch("app.services.staff_service.ZoomService")
    @patch("app.services.staff_service.model_to_dict", return_value={"id": "visit-1"})
    def test_approve_in_person_still_generates_qr(
        self,
        _mock_serialize: MagicMock,
        mock_zoom_cls: MagicMock,
        _mock_qr: MagicMock,
    ) -> None:
        visit = _online_visit()
        visit.appointmentMode = AppointmentMode.IN_PERSON.value
        self.db.query.return_value.options.return_value.filter.return_value.first.return_value = visit

        result = self.service.approve_visit("visit-online-1", "doc-1")

        mock_zoom_cls.return_value.create_scheduled_meeting.assert_not_called()
        self.assertIn("pamphletImage", result)
        self.assertIsNotNone(visit.visitQRCode)
        self.assertIsNotNone(visit.checkInOtp)
        self.service.notifications.notify_visitor_approval.assert_called_once()
        self.service.notifications.notify_visitor_online_approval.assert_not_called()


if __name__ == "__main__":
    unittest.main()
