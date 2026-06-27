import enum


class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    CHAIN_ADMIN = "CHAIN_ADMIN"
    BRANCH_ADMIN = "BRANCH_ADMIN"
    HOSPITAL_ADMIN = "HOSPITAL_ADMIN"
    DEPARTMENT_ADMIN = "DEPARTMENT_ADMIN"
    SUB_DEPARTMENT_ADMIN = "SUB_DEPARTMENT_ADMIN"
    SECURITY_SUPERVISOR = "SECURITY_SUPERVISOR"
    SECURITY = "SECURITY"
    STAFF = "STAFF"


class VisitStatus(str, enum.Enum):
    PENDING = "PENDING"
    REQUEST_SENT = "REQUEST_SENT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"


class VisitCategory(str, enum.Enum):
    MEETING = "MEETING"
    DELIVERY = "DELIVERY"


class AppointmentMode(str, enum.Enum):
    IN_PERSON = "IN_PERSON"
    ONLINE = "ONLINE"


class ProfileStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class EmailType(str, enum.Enum):
    WORK = "WORK"
    PERSONAL = "PERSONAL"


class GovtIdType(str, enum.Enum):
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    PASSPORT = "PASSPORT"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    VOTER_ID = "VOTER_ID"
    OTHER = "OTHER"


class VisitorAuthProvider(str, enum.Enum):
    PASSWORD = "PASSWORD"
    GOOGLE = "GOOGLE"
    LINKEDIN = "LINKEDIN"


class VisitorDocumentType(str, enum.Enum):
    LIVE_PHOTO = "LIVE_PHOTO"
    GOVT_ID = "GOVT_ID"
