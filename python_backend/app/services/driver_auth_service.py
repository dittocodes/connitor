"""Driver authentication (password + email OTP)."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User
from app.services.auth_service import AuthService


class DriverAuthService(AuthService):
    def _load_driver_by_email(self, email: str) -> User:
        user = self._load_user_by_email(email)
        if user.role != "DELIVERY_AGENT":
            raise HTTPException(status_code=403, detail="This login is for drivers only.")
        if not user.deliveryAgentId:
            raise HTTPException(status_code=403, detail="Driver account is not fully set up.")
        return user

    def login_with_password(self, email: str, password: str) -> dict:
        user = self._load_driver_by_email(email)
        from app.utils.passwords import verify_password

        if not user.passwordHash or not verify_password(password, user.passwordHash):
            raise HTTPException(status_code=401, detail="Invalid login ID or password.")
        return self._issue_access_token(user)

    def login(self, email: str) -> dict:
        self._load_driver_by_email(email)
        return super().login(email)

    def verify_otp(self, email: str, otp: str) -> dict:
        self._load_driver_by_email(email)
        return super().verify_otp(email, otp)

    def get_profile(self, user_id: str) -> dict:
        user = self.db.get(User, user_id)
        if not user or user.role != "DELIVERY_AGENT":
            raise HTTPException(status_code=404, detail="Driver not found")
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "deliveryAgentId": user.deliveryAgentId,
            "role": user.role,
        }
