from datetime import datetime, timedelta

import bcrypt
from fastapi import HTTPException
from jose import jwt
from sqlalchemy.orm import Session, joinedload

from app.config import get_fixed_otp, get_settings, is_test_mode_enabled
from app.models import User
from app.services.messaging_service import EmailService
from app.utils.serializers import model_to_dict


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.email = EmailService()

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    def login(self, email: str) -> dict:
        normalized = self.normalize_email(email)
        user = self.db.query(User).filter(User.email == normalized).first()
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please contact admin to register your email.",
            )
        if not user.isActive:
            raise HTTPException(status_code=403, detail="User account is inactive.")

        settings = get_settings()
        fixed = get_fixed_otp(settings)
        otp = fixed or f"{__import__('random').randint(100000, 999999)}"
        otp_expires = datetime.utcnow() + timedelta(minutes=3)
        hashed = bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()

        user.otp = hashed
        user.otpExpires = otp_expires
        self.db.commit()

        response: dict = {"message": "OTP sent successfully. Check your email inbox."}

        if is_test_mode_enabled(settings):
            response["testOtp"] = otp
        else:
            try:
                self.email.send_otp(normalized, otp)
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail="Failed to send OTP email. Please try again later.",
                ) from exc

        return response

    def verify_otp(self, email: str, otp: str) -> dict:
        normalized = self.normalize_email(email)
        user = (
            self.db.query(User)
            .options(joinedload(User.hospitalChain), joinedload(User.branch))
            .filter(User.email == normalized)
            .first()
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        settings = get_settings()
        if not is_test_mode_enabled(settings):
            if not user.otpExpires or user.otpExpires < datetime.utcnow():
                user.otp = None
                user.otpExpires = None
                self.db.commit()
                raise HTTPException(
                    status_code=401,
                    detail="OTP has expired. Please request a new OTP.",
                )
            if not user.otp or not bcrypt.checkpw(otp.encode(), user.otp.encode()):
                raise HTTPException(status_code=401, detail="Invalid OTP")

        user.otp = None
        user.otpExpires = None
        self.db.commit()

        payload = {
            "sub": user.id,
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "email": user.email,
            "role": user.role,
            "userType": user.userType,
            "isActive": user.isActive,
            "department": user.department,
            "location": user.location,
            "hospitalChainId": user.hospitalChainId,
            "branchId": user.branchId,
        }
        if user.hospitalChain:
            payload["hospitalChainName"] = user.hospitalChain.name
        if user.branch:
            payload["branchName"] = user.branch.name

        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
        return {"access_token": token}

    def get_profile(self, user_id: str) -> dict:
        user = (
            self.db.query(User)
            .options(joinedload(User.hospitalChain), joinedload(User.branch))
            .filter(User.id == user_id)
            .first()
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        data = model_to_dict(user)
        data["hospitalChain"] = model_to_dict(user.hospitalChain) if user.hospitalChain else None
        data["branch"] = model_to_dict(user.branch) if user.branch else None
        return data
