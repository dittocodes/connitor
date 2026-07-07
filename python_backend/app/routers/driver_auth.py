"""Driver authentication routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_driver
from app.services.driver_auth_service import DriverAuthService

router = APIRouter()


class DriverLoginBody(BaseModel):
    email: EmailStr
    password: str


class DriverOtpRequestBody(BaseModel):
    email: EmailStr


class DriverOtpVerifyBody(BaseModel):
    email: EmailStr
    otp: str


@router.post("/login")
def driver_login(body: DriverLoginBody, db: Session = Depends(get_db)):
    return DriverAuthService(db).login_with_password(body.email, body.password)


@router.post("/request-otp")
def driver_request_otp(body: DriverOtpRequestBody, db: Session = Depends(get_db)):
    return DriverAuthService(db).login(body.email)


@router.post("/verify-otp")
def driver_verify_otp(body: DriverOtpVerifyBody, db: Session = Depends(get_db)):
    return DriverAuthService(db).verify_otp(body.email, body.otp)


@router.get("/me")
def driver_me(user: Annotated[dict, Depends(get_current_driver)], db: Session = Depends(get_db)):
    return DriverAuthService(db).get_profile(user["id"])
