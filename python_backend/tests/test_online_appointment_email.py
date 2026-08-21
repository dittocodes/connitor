import unittest

from app.email_templates import build_online_appointment_email


class OnlineAppointmentEmailTests(unittest.TestCase):
    def test_visitor_email_contains_join_link(self) -> None:
        join_url = "https://us05web.zoom.us/j/88957292084?pwd=test"
        subject, text_body, html_body = build_online_appointment_email(
            recipient_name="Rahul Mehta",
            doctor_name="Dr. Arjun Desai",
            appointment_date="10 Jun 2026 10:00",
            zoom_url=join_url,
            doctor_feedback="Please join 5 minutes early.",
            is_host=False,
            meeting_password="V10h5K",
        )

        self.assertIn("Zoom link", subject)
        self.assertIn(join_url, text_body)
        self.assertIn(join_url, html_body)
        self.assertIn("Join Zoom Meeting", html_body)
        self.assertIn("V10h5K", text_body)
        self.assertNotIn("Start Zoom Meeting", html_body)

    def test_doctor_email_contains_host_link(self) -> None:
        start_url = "https://us05web.zoom.us/s/88957292084?zak=token"
        _subject, text_body, html_body = build_online_appointment_email(
            recipient_name="Dr. Arjun Desai",
            doctor_name="Dr. Arjun Desai",
            appointment_date="10 Jun 2026 10:00",
            zoom_url=start_url,
            is_host=True,
        )

        self.assertIn(start_url, text_body)
        self.assertIn(start_url, html_body)
        self.assertIn("Start Zoom Meeting", html_body)


if __name__ == "__main__":
    unittest.main()
