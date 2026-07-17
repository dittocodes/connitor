"""Security gate operations for inbound deliveries."""

from __future__ import annotations

import hashlib
import hmac

from sqlalchemy.orm import Session

from app.config import get_settings
from app.delivery.inbound_delivery_service import InboundDeliveryService
from app.delivery.utils import bad_request, not_found
from app.models.delivery_entities import (
    DeliveryGateEntry,
    DeliveryGateExit,
    DeliveryQrCode,
    DeliverySecurityScan,
    DeliveryVisitorLog,
    InboundDelivery,
    VisitDeliveryLink,
)
from app.models.enums import DeliveryStatus
from app.utils.timezone import now_ist


class DeliveryGateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.delivery_svc = InboundDeliveryService(db)

    def allow_entry(self, user: dict, delivery_id: str, gate_id: str | None = None) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery:
            raise not_found("Delivery")
        if delivery.status not in (
            DeliveryStatus.SCHEDULED.value,
            DeliveryStatus.APPROVED.value,
        ):
            raise bad_request(
                f"Allow entry only for SCHEDULED/APPROVED deliveries (current: {delivery.status})"
            )
        pass_number = f"PASS-{now_ist().year}-{delivery.deliveryNumber[-6:]}"
        self.db.add(
            DeliveryGateEntry(
                deliveryId=delivery.id,
                gateId=gate_id,
                passNumber=pass_number,
                allowedById=user["id"],
            )
        )
        self.delivery_svc.transition_status(
            delivery.id, user, DeliveryStatus.ARRIVED_AT_GATE.value, "Gate entry allowed"
        )
        return {"passNumber": pass_number, "deliveryId": delivery.id}

    def mark_exit(self, user: dict, delivery_id: str) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery:
            raise not_found("Delivery")
        if delivery.status != DeliveryStatus.RECEIVED.value:
            raise bad_request(
                f"Mark exit only after GRN (RECEIVED). Current status: {delivery.status}"
            )
        self.db.add(
            DeliveryGateExit(
                deliveryId=delivery.id,
                markedById=user["id"],
            )
        )
        updated = self.delivery_svc.transition_status(
            delivery.id, user, DeliveryStatus.EXITED.value, "Exited gate"
        )
        return {"deliveryId": delivery.id, "status": updated.get("status", DeliveryStatus.EXITED.value)}

    def scan_qr(self, user: dict, qr_payload: str, signature: str) -> dict:
        secret = get_settings().jwt_secret
        expected = hmac.new(secret.encode(), qr_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise bad_request("Invalid QR signature")

        qr = self.db.query(DeliveryQrCode).filter(DeliveryQrCode.qrPayload == qr_payload).first()
        if not qr:
            raise not_found("QR code")
        if qr.expiresAt < now_ist():
            raise bad_request("QR code expired")

        delivery = self.db.get(InboundDelivery, qr.deliveryId)
        if not delivery:
            raise not_found("Delivery")

        user_branch = user.get("branchId")
        if user_branch and delivery.branchId != user_branch and user.get("role") != "SUPER_ADMIN":
            raise bad_request("Delivery belongs to another branch")

        self.db.add(
            DeliverySecurityScan(
                deliveryId=delivery.id,
                scannedById=user["id"],
                scanResult="VALID",
            )
        )
        self.db.commit()
        return {
            "valid": True,
            "delivery": self.delivery_svc._serialize_dashboard(delivery),
        }

    def register_courier(self, user: dict, data: dict) -> dict:
        log = DeliveryVisitorLog(
            branchId=data["branchId"],
            agentName=data.get("agentName"),
            mobileNumber=data.get("mobileNumber"),
            vehicleNumber=data.get("vehicleNumber"),
            purpose=f"COURIER:{data.get('courierCompany', 'Unknown')}",
            status="INSIDE",
            entryTime=now_ist(),
        )
        self.db.add(log)
        self.db.flush()
        if data.get("visitId"):
            self.db.add(VisitDeliveryLink(visitId=data["visitId"], visitorLogId=log.id))
        self.db.commit()
        return {"id": log.id, "status": log.status, "purpose": log.purpose}

    def unified_queue(self, user: dict, branch_id: str) -> dict:
        from app.models import Visit

        pending_visits = (
            self.db.query(Visit)
            .filter(
                Visit.branchId == branch_id,
                Visit.status.in_(["REQUEST_SENT", "APPROVED"]),
            )
            .order_by(Visit.createdAt.desc())
            .limit(50)
            .all()
        )
        scheduled = (
            self.db.query(InboundDelivery)
            .filter(
                InboundDelivery.branchId == branch_id,
                InboundDelivery.status.in_(
                    ["SCHEDULED", "APPROVED", "ARRIVED_AT_GATE", "GATE_VERIFIED"]
                ),
            )
            .order_by(InboundDelivery.expectedArrivalTime.asc())
            .limit(50)
            .all()
        )
        from app.models.delivery_entities import DeliveryAgent, DeliveryVehicle, Distributor

        vendor_deliveries = []
        for d in scheduled:
            vendor = self.db.get(Distributor, d.vendorId)
            agent = self.db.get(DeliveryAgent, d.agentId)
            vehicle = self.db.get(DeliveryVehicle, d.vehicleId)
            vendor_deliveries.append(
                {
                    "id": d.id,
                    "type": "INBOUND_DELIVERY",
                    "deliveryNumber": d.deliveryNumber,
                    "status": d.status,
                    "poNumber": d.poNumber,
                    "goodsType": d.goodsType,
                    "totalBoxes": d.totalBoxes,
                    "expectedArrivalTime": d.expectedArrivalTime.isoformat() if d.expectedArrivalTime else None,
                    "vendorName": vendor.vendorName if vendor else None,
                    "agentName": agent.name if agent else None,
                    "vehicleNumber": vehicle.registrationNumber if vehicle else None,
                }
            )
        return {
            "walkInVisits": [
                {
                    "id": v.id,
                    "type": "VISIT",
                    "visitCategory": v.visitCategory,
                    "status": v.status,
                    "platform": v.deliveryPlatform,
                    "recipient": v.deliveryRecipient,
                }
                for v in pending_visits
            ],
            "vendorDeliveries": vendor_deliveries,
        }
