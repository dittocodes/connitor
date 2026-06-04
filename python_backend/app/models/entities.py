import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str | None] = mapped_column(String(191), nullable=True)
    phone: Mapped[str] = mapped_column(String(191), unique=True)
    email: Mapped[str | None] = mapped_column(String(191), unique=True, nullable=True)
    role: Mapped[str] = mapped_column(String(50))
    userType: Mapped[str | None] = mapped_column(String(50), nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    otp: Mapped[str | None] = mapped_column(String(191), nullable=True)
    otpExpires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    department: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location: Mapped[str | None] = mapped_column(String(191), nullable=True)
    hospitalChainId: Mapped[str | None] = mapped_column(String(36), ForeignKey("HospitalChain.id"), nullable=True)
    branchId: Mapped[str | None] = mapped_column(String(36), ForeignKey("Branch.id"), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hospitalChain = relationship("HospitalChain", back_populates="users")
    branch = relationship("Branch", back_populates="users")


class HospitalChain(Base):
    __tablename__ = "HospitalChain"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(191))
    phone: Mapped[str] = mapped_column(String(191), unique=True)
    email: Mapped[str] = mapped_column(String(191), unique=True)
    street: Mapped[str] = mapped_column(String(191))
    city: Mapped[str] = mapped_column(String(191))
    state: Mapped[str] = mapped_column(String(191))
    pinCode: Mapped[str] = mapped_column(String(191))
    country: Mapped[str] = mapped_column(String(191), default="India")
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="hospitalChain")
    branches = relationship("Branch", back_populates="hospitalChain")


class Branch(Base):
    __tablename__ = "Branch"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(191))
    email: Mapped[str] = mapped_column(String(191), unique=True)
    phone: Mapped[str] = mapped_column(String(191), unique=True)
    street: Mapped[str] = mapped_column(String(191))
    city: Mapped[str] = mapped_column(String(191))
    state: Mapped[str] = mapped_column(String(191))
    pinCode: Mapped[str] = mapped_column(String(191))
    country: Mapped[str] = mapped_column(String(191), default="India")
    qrCode: Mapped[str | None] = mapped_column(Text, nullable=True)
    hospitalChainId: Mapped[str] = mapped_column(String(36), ForeignKey("HospitalChain.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hospitalChain = relationship("HospitalChain", back_populates="branches")
    users = relationship("User", back_populates="branch")
    visits = relationship("Visit", back_populates="branch")


class Visitor(Base):
    __tablename__ = "Visitor"
    __table_args__ = (UniqueConstraint("phone", "branchId", name="Visitor_phone_branchId_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    firstName: Mapped[str] = mapped_column(String(191))
    middleName: Mapped[str | None] = mapped_column(String(191), nullable=True)
    lastName: Mapped[str] = mapped_column(String(191))
    phone: Mapped[str] = mapped_column(String(191))
    alternatePhone: Mapped[str | None] = mapped_column(String(191), nullable=True)
    email: Mapped[str | None] = mapped_column(String(191), nullable=True)
    alternateEmail: Mapped[str | None] = mapped_column(String(191), nullable=True)
    address: Mapped[str | None] = mapped_column(String(191), nullable=True)
    company: Mapped[str | None] = mapped_column(String(191), nullable=True)
    companyWebsite: Mapped[str | None] = mapped_column(String(191), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(191), nullable=True)
    reportingManagerName: Mapped[str | None] = mapped_column(String(191), nullable=True)
    reportingManagerPhone: Mapped[str | None] = mapped_column(String(191), nullable=True)
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    governmentIdDocument: Mapped[str | None] = mapped_column(Text, nullable=True)
    officeIdDocument: Mapped[str | None] = mapped_column(Text, nullable=True)
    phoneVerificationOtp: Mapped[str | None] = mapped_column(String(191), nullable=True)
    phoneVerificationExpiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    phoneVerified: Mapped[bool] = mapped_column(Boolean, default=False)
    phoneVerificationAttempts: Mapped[int] = mapped_column(Integer, default=0)
    branchId: Mapped[str] = mapped_column(String(36))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visits = relationship("Visit", back_populates="visitor")


class Visit(Base):
    __tablename__ = "Visit"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    visitCategory: Mapped[str | None] = mapped_column(String(50), nullable=True)
    visitSubType: Mapped[str | None] = mapped_column(String(191), nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(191), nullable=True)
    department: Mapped[str | None] = mapped_column(String(50), nullable=True)
    deliveryPlatform: Mapped[str | None] = mapped_column(String(191), nullable=True)
    deliveryRecipient: Mapped[str | None] = mapped_column(String(191), nullable=True)
    orderReference: Mapped[str | None] = mapped_column(String(191), nullable=True)
    checkInTime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checkOutTime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checkedInById: Mapped[str | None] = mapped_column(String(36), ForeignKey("User.id"), nullable=True)
    checkedOutById: Mapped[str | None] = mapped_column(String(36), ForeignKey("User.id"), nullable=True)
    checkedInLocation: Mapped[str | None] = mapped_column(String(191), nullable=True)
    checkedOutLocation: Mapped[str | None] = mapped_column(String(191), nullable=True)
    durationMinutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    visitCode: Mapped[str | None] = mapped_column(String(191), unique=True, nullable=True)
    visitQRCode: Mapped[str | None] = mapped_column(Text, nullable=True)
    isCodeUsed: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(50))
    rejectionReason: Mapped[str | None] = mapped_column(String(191), nullable=True)
    checkInOtp: Mapped[str | None] = mapped_column(String(191), nullable=True)
    checkInOtpExpiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    gatePassGeneratedAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    gatePassSentViaWhatsApp: Mapped[bool] = mapped_column(Boolean, default=False)
    gatePassUrlExpiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    visitorId: Mapped[str] = mapped_column(String(36), ForeignKey("Visitor.id"))
    staffId: Mapped[str | None] = mapped_column(String(36), ForeignKey("User.id"), nullable=True)
    staffName: Mapped[str | None] = mapped_column(String(191), nullable=True)
    staffPhone: Mapped[str | None] = mapped_column(String(191), nullable=True)
    visitingCardPhoto: Mapped[str | None] = mapped_column(Text, nullable=True)
    branchId: Mapped[str] = mapped_column(String(36), ForeignKey("Branch.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visitor = relationship("Visitor", back_populates="visits")
    branch = relationship("Branch", back_populates="visits")
    staff = relationship("User", foreign_keys=[staffId])
    notifications = relationship("Notification", back_populates="visit")


class Notification(Base):
    __tablename__ = "Notification"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    message: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    recipientId: Mapped[str] = mapped_column(String(36), ForeignKey("User.id"))
    visitId: Mapped[str | None] = mapped_column(String(36), ForeignKey("Visit.id"), nullable=True)

    visit = relationship("Visit", back_populates="notifications")
