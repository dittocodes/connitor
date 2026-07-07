"""Tests for distributor booking, delivery slots, and driver auth."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.delivery.delivery_slot_service import DeliverySlotService
from app.delivery.inbound_delivery_service import InboundDeliveryService
from app.models import Branch, HospitalChain, User
from app.models.delivery_entities import (
    BranchDeliverySettings,
    BranchDeliverySlot,
    DeliveryAgent,
    DeliveryVehicle,
    Distributor,
    VendorBranchMapping,
)
from app.services.driver_auth_service import DriverAuthService
import app.models.delivery_entities  # noqa: F401
import app.models.attendant_entities  # noqa: F401
import app.models.permission_entities  # noqa: F401
from app.utils.passwords import hash_password
from app.utils.timezone import now_ist


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    chain = HospitalChain(
        id=str(uuid.uuid4()),
        name="Test Chain",
        phone="9000000000",
        email="chain@test.com",
        street="St",
        city="City",
        state="ST",
        pinCode="000000",
    )
    branch = Branch(
        id=str(uuid.uuid4()),
        name="Test Branch",
        email="branch@test.com",
        phone="9000000001",
        street="St",
        city="City",
        state="ST",
        pinCode="000000",
        hospitalChainId=chain.id,
    )
    session.add_all([chain, branch])
    session.add(BranchDeliverySettings(branchId=branch.id, allowUnscheduledDeliveries=True))
    session.commit()
    yield session
    session.close()


def _seed_vendor(db, branch_id: str) -> tuple[Distributor, User]:
    dist = Distributor(
        id=str(uuid.uuid4()),
        vendorCode="VEN-000001",
        vendorName="Test Vendor",
        vendorType="MEDICAL",
        isActive=True,
    )
    db.add(dist)
    db.flush()
    db.add(
        VendorBranchMapping(
            vendorId=dist.id,
            branchId=branch_id,
            approvalStatus="APPROVED",
        )
    )
    user = User(
        id=str(uuid.uuid4()),
        name="Distributor User",
        phone="9111111111",
        email="dist@test.com",
        role="DISTRIBUTOR",
        distributorId=dist.id,
        passwordHash=hash_password("Password1!"),
        isActive=True,
    )
    db.add(user)
    db.commit()
    return dist, user


def test_delivery_slot_booking(db):
    branch = db.query(Branch).first()
    slot_start = now_ist() + timedelta(days=1)
    slot = BranchDeliverySlot(
        branchId=branch.id,
        slotStart=slot_start,
        slotEnd=slot_start + timedelta(hours=1),
        maxDeliveries=1,
        bookedCount=0,
        isActive=True,
    )
    db.add(slot)
    db.commit()

    dist, user = _seed_vendor(db, branch.id)
    vehicle = DeliveryVehicle(
        id=str(uuid.uuid4()),
        distributorId=dist.id,
        registrationNumber="KA01TEST",
        isActive=True,
    )
    agent = DeliveryAgent(
        id=str(uuid.uuid4()),
        distributorId=dist.id,
        name="Driver One",
        email="driver@test.com",
        isActive=True,
    )
    db.add_all([vehicle, agent])
    db.commit()

    user_dict = {"id": user.id, "role": "DISTRIBUTOR", "distributorId": dist.id}
    with patch.object(InboundDeliveryService, "_generate_qr"), patch(
        "app.delivery.inbound_delivery_service.NotificationsService"
    ):
        result = InboundDeliveryService(db).book_delivery(
            user_dict,
            {
                "branchId": branch.id,
                "slotId": slot.id,
                "goodsType": "Medical supplies",
                "totalBoxes": 5,
                "vehicleId": vehicle.id,
                "agentId": agent.id,
            },
        )

    assert result["status"] == "SCHEDULED"
    assert result["goodsType"] == "Medical supplies"
    db.refresh(slot)
    assert slot.bookedCount == 1


def test_driver_password_login(db):
    agent_id = str(uuid.uuid4())
    user = User(
        id=str(uuid.uuid4()),
        name="Driver",
        phone="9222222222",
        email="driver2@test.com",
        role="DELIVERY_AGENT",
        deliveryAgentId=agent_id,
        passwordHash=hash_password("DriverPass1"),
        isActive=True,
    )
    db.add(user)
    db.commit()

    with patch("app.services.auth_service.EmailService"):
        token = DriverAuthService(db).login_with_password("driver2@test.com", "DriverPass1")
    assert "access_token" in token


def test_bulk_create_slots(db):
    branch = db.query(Branch).first()
    admin = {"id": str(uuid.uuid4()), "role": "HOSPITAL_ADMIN", "branchId": branch.id}
    start = (now_ist() + timedelta(days=1)).date()
    end = start + timedelta(days=2)
    result = DeliverySlotService(db).bulk_create_slots(
        branch.id,
        admin,
        {"startDate": start.isoformat(), "endDate": end.isoformat(), "slotMinutes": 60},
    )
    assert result["created"] > 0
