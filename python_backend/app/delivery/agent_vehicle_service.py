"""Delivery agent and vehicle management for distributors."""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy.orm import Session

from app.config import get_settings
from app.delivery.utils import bad_request, not_found
from app.models import Branch, User
from app.models.delivery_entities import (
    DeliveryAgent,
    DeliveryVehicle,
    Distributor,
    VendorBranchMapping,
)
from app.services.auth_service import AuthService
from app.services.messaging_service import EmailService
from app.utils.passwords import hash_password


class AgentVehicleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.email = EmailService()

    def _distributor_id(self, user: dict) -> str:
        dist_id = user.get("distributorId")
        if not dist_id:
            raise bad_request("Distributor account not linked")
        return dist_id

    def list_approved_branches(self, user: dict) -> dict:
        dist_id = self._distributor_id(user)
        rows = (
            self.db.query(VendorBranchMapping, Branch)
            .join(Branch, Branch.id == VendorBranchMapping.branchId)
            .filter(
                VendorBranchMapping.vendorId == dist_id,
                VendorBranchMapping.approvalStatus == "APPROVED",
            )
            .all()
        )
        return {
            "branches": [
                {
                    "id": branch.id,
                    "name": branch.name,
                    "phone": branch.phone,
                    "email": branch.email,
                    "street": branch.street,
                    "city": branch.city,
                    "state": branch.state,
                    "pinCode": branch.pinCode,
                }
                for _, branch in rows
            ]
        }

    def list_agents(self, user: dict) -> dict:
        dist_id = self._distributor_id(user)
        rows = (
            self.db.query(DeliveryAgent)
            .filter(DeliveryAgent.distributorId == dist_id, DeliveryAgent.isActive.is_(True))
            .order_by(DeliveryAgent.name.asc())
            .all()
        )
        return {"agents": [self._serialize_agent(a) for a in rows]}

    def list_vehicles(self, user: dict) -> dict:
        dist_id = self._distributor_id(user)
        rows = (
            self.db.query(DeliveryVehicle)
            .filter(DeliveryVehicle.distributorId == dist_id, DeliveryVehicle.isActive.is_(True))
            .order_by(DeliveryVehicle.registrationNumber.asc())
            .all()
        )
        return {"vehicles": [self._serialize_vehicle(v) for v in rows]}

    def create_agent(self, user: dict, data: dict) -> dict:
        dist_id = self._distributor_id(user)
        email = AuthService.normalize_email(data["email"])
        existing = self.db.query(DeliveryAgent).filter(DeliveryAgent.email == email).first()
        if existing:
            raise bad_request("A driver with this email already exists")

        agent = DeliveryAgent(
            distributorId=dist_id,
            name=data["name"].strip(),
            email=email,
            phone=data.get("phone"),
            licenseNumber=data.get("licenseNumber"),
            isActive=True,
        )
        self.db.add(agent)
        self.db.flush()

        created_user, temp_password = self._ensure_driver_user(agent, is_new=True)
        agent.userId = created_user.id
        self.db.commit()
        self.db.refresh(agent)
        result = self._serialize_agent(agent)
        result["credentialsSent"] = bool(temp_password)
        return result

    def create_vehicle(self, user: dict, data: dict) -> dict:
        dist_id = self._distributor_id(user)
        reg = data["registrationNumber"].strip().upper()
        existing = self.db.query(DeliveryVehicle).filter(DeliveryVehicle.registrationNumber == reg).first()
        if existing:
            raise bad_request("Vehicle registration already exists")
        vehicle = DeliveryVehicle(
            distributorId=dist_id,
            registrationNumber=reg,
            vehicleType=data.get("vehicleType"),
            isActive=True,
        )
        self.db.add(vehicle)
        self.db.commit()
        self.db.refresh(vehicle)
        return self._serialize_vehicle(vehicle)

    def resolve_agent(self, user: dict, data: dict | str) -> DeliveryAgent:
        dist_id = self._distributor_id(user)
        if isinstance(data, str):
            agent = self.db.get(DeliveryAgent, data)
            if not agent or agent.distributorId != dist_id:
                raise bad_request("Invalid driver")
            return agent

        if data.get("agentId"):
            return self.resolve_agent(user, data["agentId"])

        email = AuthService.normalize_email(data["email"])
        agent = (
            self.db.query(DeliveryAgent)
            .filter(DeliveryAgent.distributorId == dist_id, DeliveryAgent.email == email)
            .first()
        )
        if agent:
            if data.get("name"):
                agent.name = data["name"].strip()
            if data.get("phone"):
                agent.phone = data["phone"]
            self.db.flush()
            self._ensure_driver_user(agent, is_new=False)
            return agent

        agent = DeliveryAgent(
            distributorId=dist_id,
            name=data["name"].strip(),
            email=email,
            phone=data.get("phone"),
            licenseNumber=data.get("licenseNumber"),
            isActive=True,
        )
        self.db.add(agent)
        self.db.flush()
        created_user, _ = self._ensure_driver_user(agent, is_new=True)
        agent.userId = created_user.id
        self.db.flush()
        return agent

    def resolve_vehicle(self, user: dict, data: dict | str) -> DeliveryVehicle:
        dist_id = self._distributor_id(user)
        if isinstance(data, str):
            vehicle = self.db.get(DeliveryVehicle, data)
            if not vehicle or vehicle.distributorId != dist_id:
                raise bad_request("Invalid vehicle")
            return vehicle

        if data.get("vehicleId"):
            return self.resolve_vehicle(user, data["vehicleId"])

        reg = data["registrationNumber"].strip().upper()
        vehicle = (
            self.db.query(DeliveryVehicle)
            .filter(DeliveryVehicle.distributorId == dist_id, DeliveryVehicle.registrationNumber == reg)
            .first()
        )
        if vehicle:
            if data.get("vehicleType"):
                vehicle.vehicleType = data["vehicleType"]
            self.db.flush()
            return vehicle

        vehicle = DeliveryVehicle(
            distributorId=dist_id,
            registrationNumber=reg,
            vehicleType=data.get("vehicleType"),
            isActive=True,
        )
        self.db.add(vehicle)
        self.db.flush()
        return vehicle

    def _ensure_driver_user(self, agent: DeliveryAgent, *, is_new: bool) -> tuple[User, str | None]:
        settings = get_settings()
        login_url = f"{settings.frontend_url.rstrip('/')}/driver/login"
        temp_password: str | None = None

        if agent.userId:
            driver_user = self.db.get(User, agent.userId)
            if driver_user:
                if is_new:
                    self._send_assignment_email(agent, login_url)
                return driver_user, None

        existing = self.db.query(User).filter(User.email == agent.email).first()
        if existing:
            if existing.role != "DELIVERY_AGENT":
                raise bad_request("Email already used by another account type")
            existing.deliveryAgentId = agent.id
            existing.name = agent.name
            if is_new:
                self._send_assignment_email(agent, login_url)
            self.db.flush()
            return existing, None

        temp_password = secrets.token_urlsafe(10)
        phone = agent.phone or f"9{secrets.randbelow(900000000) + 100000000}"
        while self.db.query(User).filter(User.phone == phone).first():
            phone = f"9{secrets.randbelow(900000000) + 100000000}"

        driver_user = User(
            id=str(uuid.uuid4()),
            name=agent.name,
            phone=phone,
            email=agent.email,
            role="DELIVERY_AGENT",
            deliveryAgentId=agent.id,
            passwordHash=hash_password(temp_password),
            isActive=True,
        )
        self.db.add(driver_user)
        self.db.flush()
        self.email.send_account_credentials(
            to_email=agent.email,
            name=agent.name,
            password=temp_password,
            role="DELIVERY_AGENT",
            login_url=login_url,
        )
        return driver_user, temp_password

    def _send_assignment_email(self, agent: DeliveryAgent, login_url: str) -> None:
        settings = get_settings()
        subject = f"{settings.email_company_name} — New delivery assignment"
        message = (
            f"Hello {agent.name},\n\n"
            "You have been assigned to a new delivery. Sign in to your driver dashboard to view "
            f"check-in QR and delivery details:\n{login_url}\n"
        )
        if agent.email:
            self.email.send_notification(agent.email, subject, message)

    @staticmethod
    def _serialize_agent(agent: DeliveryAgent) -> dict:
        return {
            "id": agent.id,
            "name": agent.name,
            "email": agent.email,
            "phone": agent.phone,
            "licenseNumber": agent.licenseNumber,
            "hasLogin": bool(agent.userId),
        }

    @staticmethod
    def _serialize_vehicle(vehicle: DeliveryVehicle) -> dict:
        return {
            "id": vehicle.id,
            "registrationNumber": vehicle.registrationNumber,
            "vehicleType": vehicle.vehicleType,
        }
