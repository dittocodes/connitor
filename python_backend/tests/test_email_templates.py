import unittest

from app.email_templates import (
    build_booking_confirmation_email,
    build_check_in_otp_email,
    build_gate_pass_email,
    build_notification_email,
)


class EmailTemplateTests(unittest.TestCase):
    def test_notification_email_includes_title_and_message(self) -> None:
        subject, text, html = build_notification_email("New Request", "Patient John booked.")
        self.assertIn("New Request", subject)
        self.assertIn("Patient John booked.", text)
        self.assertIn("Patient John booked.", html)

    def test_check_in_otp_email_includes_code(self) -> None:
        subject, text, html = build_check_in_otp_email(
            "123456",
            visitor_name="Jane Doe",
            doctor_name="Dr. Smith",
            appointment_date="10 Jun 2026 14:00",
        )
        self.assertIn("123456", text)
        self.assertIn("123456", html)
        self.assertIn("Dr. Smith", text)

    def test_booking_confirmation_email_includes_status(self) -> None:
        subject, text, html = build_booking_confirmation_email(
            visitor_name="Jane Doe",
            doctor_name="Dr. Smith",
            appointment_date="10 Jun 2026 14:00",
            hospital_name="Apollo Chennai",
            booking_id="visit-123",
            department_name="Cardiology",
        )
        self.assertIn("Appointment request received", subject)
        self.assertIn("Awaiting doctor approval", text)
        self.assertIn("visit-123", text)
        self.assertIn("Cardiology", html)

    def test_gate_pass_email_includes_qr_and_otp(self) -> None:
        subject, text, html = build_gate_pass_email(
            visitor_name="Jane Doe",
            doctor_name="Dr. Smith",
            appointment_date="10 Jun 2026 14:00",
            check_in_otp="654321",
            qr_cid="checkin-qr",
        )
        self.assertIn("654321", text)
        self.assertIn("654321", html)
        self.assertIn('src="cid:checkin-qr"', html)


if __name__ == "__main__":
    unittest.main()
