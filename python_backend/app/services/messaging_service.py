import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import boto3
import httpx

from app.config import get_settings, is_test_mode_enabled
from app.email_templates import build_login_otp_email, build_registration_otp_email

logger = logging.getLogger(__name__)


class EmailService:
    def _send_via_zeptomail_api(
        self, to_email: str, subject: str, text_body: str, html_body: str
    ) -> None:
        settings = get_settings()
        api_url = settings.zeptomail_api_url
        if not api_url or not settings.smtp_password or not settings.smtp_from:
            raise ValueError("ZeptoMail API not configured")

        payload = {
            "from": {"address": settings.smtp_from, "name": settings.email_from_name},
            "to": [{"email_address": {"address": to_email}}],
            "subject": subject,
            "htmlbody": html_body,
            "textbody": text_body,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Zoho-enczapikey {settings.smtp_password}",
        }
        response = httpx.post(api_url, json=payload, headers=headers, timeout=30)
        if response.status_code not in (200, 201):
            logger.error("ZeptoMail API error %s: %s", response.status_code, response.text)
            response.raise_for_status()
        data = response.json()
        logger.info(
            "ZeptoMail API accepted email to %s (request_id=%s)",
            to_email,
            data.get("request_id"),
        )

    def _send_via_smtp(
        self, to_email: str, subject: str, text_body: str, html_body: str
    ) -> None:
        settings = get_settings()
        message = MIMEMultipart("alternative")
        message["From"] = f"{settings.email_from_name} <{settings.smtp_from}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))

        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_from, [to_email], message.as_string())
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_from, [to_email], message.as_string())
        logger.info("SMTP accepted email to %s", to_email)

    def send_otp(self, to_email: str, otp: str) -> None:
        settings = get_settings()
        subject, text_body, html_body = build_login_otp_email(
            otp,
            company_name=settings.email_from_name,
            product_name=settings.email_product_name,
        )

        if is_test_mode_enabled(settings):
            logger.info("[HVTS_TEST_MODE] Email OTP to %s: %s", to_email, otp)
            return

        if not settings.smtp_from:
            logger.warning("SMTP not configured; OTP for %s: %s", to_email, otp)
            return

        try:
            if settings.zeptomail_api_url:
                self._send_via_zeptomail_api(to_email, subject, text_body, html_body)
            elif settings.smtp_host:
                self._send_via_smtp(to_email, subject, text_body, html_body)
            else:
                logger.warning("No email transport configured; OTP for %s: %s", to_email, otp)
        except Exception as exc:
            logger.error("Failed to send OTP email to %s: %s", to_email, exc)
            raise

    def send_registration_otp(self, to_email: str, otp: str) -> None:
        settings = get_settings()
        subject, text_body, html_body = build_registration_otp_email(
            otp,
            company_name=settings.email_from_name,
            product_name=settings.email_product_name,
            validity_minutes=10,
        )

        if is_test_mode_enabled(settings):
            logger.info("[HVTS_TEST_MODE] Registration OTP to %s: %s", to_email, otp)
            return

        if not settings.smtp_from:
            logger.warning("SMTP not configured; registration OTP for %s: %s", to_email, otp)
            return

        try:
            if settings.zeptomail_api_url:
                self._send_via_zeptomail_api(to_email, subject, text_body, html_body)
            elif settings.smtp_host:
                self._send_via_smtp(to_email, subject, text_body, html_body)
            else:
                logger.warning(
                    "No email transport configured; registration OTP for %s: %s", to_email, otp
                )
        except Exception as exc:
            logger.error("Failed to send registration OTP to %s: %s", to_email, exc)
            raise


class SmsService:
    def send_otp(self, phone: str, otp: str) -> None:
        settings = get_settings()
        message = (
            f"Login in HVTS: Your One-Time Password is {otp}. "
            "It is valid for 3 minutes. Do not share it."
        )
        if is_test_mode_enabled(settings):
            logger.info("[HVTS_TEST_MODE] SMS mocked to %s: %s", phone, message)
            return

        if not settings.aws_region or not settings.aws_access_key_id:
            logger.warning("AWS SNS not configured; OTP logged only: %s", otp)
            return

        client = boto3.client(
            "sns",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        phone_number = phone if phone.startswith("+") else f"+91{phone}"
        client.publish(Message=message, PhoneNumber=phone_number)


class WhatsAppService:
    def send_gate_pass(self, phone: str, visitor_name: str, gate_pass_url: str) -> None:
        settings = get_settings()
        if not settings.whatsapp_api_url or not settings.whatsapp_access_token:
            logger.warning("WhatsApp not configured; gate pass URL: %s", gate_pass_url)
            return

        url = (
            f"{settings.whatsapp_api_url.rstrip('/')}/"
            f"{settings.whatsapp_phone_number_id}/messages"
        )
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": settings.whatsapp_template_gate_pass,
                "language": {"code": "en"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": visitor_name},
                            {"type": "text", "text": gate_pass_url},
                        ],
                    }
                ],
            },
        }
        headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
        httpx.post(url, json=payload, headers=headers, timeout=30)
