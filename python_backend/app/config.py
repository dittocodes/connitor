from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8000
    host: str = "0.0.0.0"
    database_url: str = "mysql+pymysql://root:password@localhost:3306/hvts"

    jwt_secret: str = "change-me"
    jwt_expires_in: str = "1d"

    visitor_form_url: str = "http://localhost:3000/public-qr-visitor-form/"

    gcp_project_id: str | None = None
    gcp_bucket_name: str | None = None
    google_application_credentials: str | None = None
    gcp_public_url: str | None = None

    aws_region: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    email_from_name: str = "Connitor"
    email_product_name: str = "Hospital Visitor Tracking System"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    # Use HVTS_TEST_MODE — generic TEST_MODE is often set on Windows and overrides .env
    hvts_test_mode: bool = Field(default=False, validation_alias="HVTS_TEST_MODE")
    zeptomail_api_url: str | None = None

    whatsapp_api_url: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_template_gate_pass: str = "gate_pass_approved"

    node_env: Literal["development", "test", "production"] = "development"
    e2e_fixed_otp: str = "123456"
    demo_mode: bool = False

    rate_limit_sms_per_hour: int = 3
    rate_limit_skip_in_test_mode: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


def is_test_mode_enabled(settings: Settings) -> bool:
    if settings.node_env == "production" and settings.hvts_test_mode:
        return False
    return settings.hvts_test_mode and settings.node_env != "production"


def is_demo_mode_enabled(settings: Settings) -> bool:
    if settings.node_env == "production" and settings.demo_mode:
        return False
    return settings.demo_mode and settings.node_env != "production"


def get_fixed_otp(settings: Settings) -> str | None:
    if not is_test_mode_enabled(settings):
        return None
    otp = settings.e2e_fixed_otp
    if len(otp) == 6 and otp.isdigit():
        return otp
    return None
