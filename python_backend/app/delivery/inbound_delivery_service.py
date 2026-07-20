"""Inbound delivery lifecycle service."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config import get_settings
from app.delivery.agent_vehicle_service import AgentVehicleService
from app.delivery.delivery_slot_service import DeliverySlotService
from app.delivery.utils import bad_request, not_found, resolve_branch_filter
from app.models.delivery_entities import (
    BranchDeliverySettings,
    DeliveryAgent,
    DeliveryNumberSequence,
    DeliveryQrCode,
    DeliverySecurityScan,
    DeliveryVehicle,
    Distributor,
    InboundDelivery,
    InboundDeliveryItem,
    InboundDeliveryStatusHistory,
    VendorBranchMapping,
    VendorWallet,
    WalletTransaction,
)
from app.models import Branch
from app.models.enums import DeliveryStatus, DeliveryType
from app.services.notifications_service import NotificationsService
from app.utils.timezone import now_ist

EDITABLE = {DeliveryStatus.DRAFT.value, DeliveryStatus.SCHEDULED.value}

# Canonical happy-path: SCHEDULED → ARRIVED_AT_GATE → IN_PROGRESS → RECEIVED → EXITED
# GATE_VERIFIED kept as a legacy synonym of "at gate" (same transitions as ARRIVED_AT_GATE).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    DeliveryStatus.DRAFT.value: {DeliveryStatus.SCHEDULED.value, DeliveryStatus.REJECTED.value},
    DeliveryStatus.SCHEDULED.value: {
        DeliveryStatus.ARRIVED_AT_GATE.value,
        DeliveryStatus.GATE_VERIFIED.value,
        DeliveryStatus.REJECTED.value,
    },
    DeliveryStatus.APPROVED.value: {
        DeliveryStatus.ARRIVED_AT_GATE.value,
        DeliveryStatus.GATE_VERIFIED.value,
        DeliveryStatus.REJECTED.value,
    },
    DeliveryStatus.ARRIVED_AT_GATE.value: {
        DeliveryStatus.GATE_VERIFIED.value,
        DeliveryStatus.IN_PROGRESS.value,
        DeliveryStatus.REJECTED.value,
    },
    DeliveryStatus.GATE_VERIFIED.value: {
        DeliveryStatus.IN_PROGRESS.value,
        DeliveryStatus.REJECTED.value,
    },
    DeliveryStatus.IN_PROGRESS.value: {
        DeliveryStatus.RECEIVED.value,
        DeliveryStatus.REJECTED.value,
    },
    DeliveryStatus.RECEIVED.value: {DeliveryStatus.EXITED.value, DeliveryStatus.COMPLETED.value},
    DeliveryStatus.COMPLETED.value: {DeliveryStatus.EXITED.value, DeliveryStatus.CLOSED.value},
    DeliveryStatus.EXITED.value: {DeliveryStatus.CLOSED.value},
    DeliveryStatus.REJECTED.value: set(),
    DeliveryStatus.CLOSED.value: set(),
}


class InboundDeliveryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _next_delivery_number(self) -> str:
        year = now_ist().year
        seq = self.db.get(DeliveryNumberSequence, year)
        if not seq:
            seq = DeliveryNumberSequence(year=year, lastNumber=0)
            self.db.add(seq)
        seq.lastNumber += 1
        self.db.flush()
        return f"DLV-{year}-{seq.lastNumber:06d}"

    def _history(self, delivery_id: str, old: str | None, new: str, user_id: str | None, remarks: str = "") -> None:
        self.db.add(
            InboundDeliveryStatusHistory(
                deliveryId=delivery_id,
                oldStatus=old,
                newStatus=new,
                changedById=user_id,
                remarks=remarks,
            )
        )

    def list_deliveries(
        self,
        user: dict,
        *,
        branch_id: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> dict:
        branch = resolve_branch_filter(user, branch_id)
        q = self.db.query(InboundDelivery).filter(InboundDelivery.isActive.is_(True))
        if branch:
            q = q.filter(InboundDelivery.branchId == branch)
        if status:
            q = q.filter(InboundDelivery.status == status)
        if user.get("role") == "DISTRIBUTOR" and user.get("distributorId"):
            q = q.filter(InboundDelivery.vendorId == user["distributorId"])
        total = q.count()
        rows = q.order_by(InboundDelivery.createdAt.desc()).offset(skip).limit(limit).all()
        return {"total": total, "items": [self._serialize_dashboard(d) for d in rows]}

    def get_delivery(self, delivery_id: str, user: dict) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery or not delivery.isActive:
            raise not_found("Delivery")
        return self._serialize_dashboard(delivery)

    def create_delivery(self, user: dict, data: dict) -> dict:
        branch_id = data.get("branchId") or user.get("branchId")
        if not branch_id:
            raise bad_request("branchId is required")
        vendor_id = data.get("vendorId")
        if user.get("role") == "DISTRIBUTOR":
            vendor_id = user.get("distributorId")
        if not vendor_id:
            raise bad_request("vendorId is required")

        delivery = InboundDelivery(
            deliveryNumber=self._next_delivery_number(),
            branchId=branch_id,
            vendorId=vendor_id,
            vehicleId=data["vehicleId"],
            agentId=data["agentId"],
            deliveryType=data.get("deliveryType", DeliveryType.STANDARD.value),
            status=DeliveryStatus.DRAFT.value,
            poNumber=data.get("poNumber"),
            invoiceNumber=data.get("invoiceNumber"),
            expectedDeliveryDate=data.get("expectedDeliveryDate"),
            totalBoxes=int(data.get("totalBoxes") or 0),
            remarks=data.get("remarks"),
            urgentReason=data.get("urgentReason"),
            createdById=user.get("id"),
        )
        self.db.add(delivery)
        self.db.flush()
        for item in data.get("items") or []:
            self.db.add(
                InboundDeliveryItem(
                    deliveryId=delivery.id,
                    itemName=item.get("itemName", "Item"),
                    quantityOrdered=int(item.get("quantityOrdered") or 0),
                    unit=item.get("unit"),
                )
            )
        self._history(delivery.id, None, DeliveryStatus.DRAFT.value, user.get("id"), "Created")
        self.db.commit()
        self.db.refresh(delivery)
        return self._serialize(delivery, full=True)

    def schedule_delivery(self, delivery_id: str, user: dict) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery:
            raise not_found("Delivery")
        if delivery.status != DeliveryStatus.DRAFT.value:
            raise bad_request("Only DRAFT deliveries can be scheduled")
        old = delivery.status
        delivery.status = DeliveryStatus.SCHEDULED.value
        settings = get_settings()
        if settings.delivery_wallet_enabled:
            delivery.walletFee = Decimal(str(delivery.walletFee or 0)) + Decimal("100")
            self._deduct_wallet(delivery.vendorId, delivery.walletFee, delivery.id, user.get("id"))
        self._generate_qr(delivery)
        self._history(delivery.id, old, delivery.status, user.get("id"), "Scheduled")
        self.db.commit()
        self.db.refresh(delivery)
        return self._serialize(delivery, full=True)

    def book_delivery(self, user: dict, data: dict) -> dict:
        """Distributor books a delivery in one step: SCHEDULED + QR."""
        branch_id = data.get("branchId")
        if not branch_id:
            raise bad_request("branchId is required")

        vendor_id = user.get("distributorId") if user.get("role") == "DISTRIBUTOR" else data.get("vendorId")
        if not vendor_id:
            raise bad_request("vendorId is required")

        mapping = (
            self.db.query(VendorBranchMapping)
            .filter(
                VendorBranchMapping.vendorId == vendor_id,
                VendorBranchMapping.branchId == branch_id,
                VendorBranchMapping.approvalStatus == "APPROVED",
            )
            .first()
        )
        if not mapping:
            raise bad_request("Distributor is not approved for this hospital branch")

        goods_type = (data.get("goodsType") or "").strip()
        if not goods_type:
            raise bad_request("goodsType is required")
        total_boxes = int(data.get("totalBoxes") or 0)
        if total_boxes < 1:
            raise bad_request("totalBoxes must be at least 1")

        agent_svc = AgentVehicleService(self.db)
        vehicle = agent_svc.resolve_vehicle(user, data.get("vehicle") or data.get("vehicleId"))
        agent = agent_svc.resolve_agent(user, data.get("agent") or data.get("agentId"))
        if not vehicle:
            raise bad_request("vehicle is required")
        if not agent:
            raise bad_request("driver is required")

        slot_id = data.get("slotId")
        expected_arrival = data.get("expectedArrivalTime")
        slot = None
        if slot_id:
            slot = DeliverySlotService(self.db).reserve_slot(slot_id)
            if slot.branchId != branch_id:
                raise bad_request("Slot does not belong to selected branch")
            expected_arrival = slot.slotStart
        elif expected_arrival:
            settings_row = (
                self.db.query(BranchDeliverySettings)
                .filter(BranchDeliverySettings.branchId == branch_id)
                .first()
            )
            if settings_row and not settings_row.allowUnscheduledDeliveries:
                raise bad_request("This hospital requires a delivery time slot")
            if isinstance(expected_arrival, str):
                from app.utils.timezone import parse_to_ist_naive

                expected_arrival = parse_to_ist_naive(expected_arrival)
        else:
            raise bad_request("slotId or expectedArrivalTime is required")

        delivery = InboundDelivery(
            deliveryNumber=self._next_delivery_number(),
            branchId=branch_id,
            vendorId=vendor_id,
            vehicleId=vehicle.id,
            agentId=agent.id,
            slotId=slot.id if slot else None,
            goodsType=goods_type,
            deliveryType=data.get("deliveryType", DeliveryType.STANDARD.value),
            status=DeliveryStatus.SCHEDULED.value,
            expectedArrivalTime=expected_arrival,
            expectedDeliveryDate=expected_arrival.date() if expected_arrival else None,
            totalBoxes=total_boxes,
            remarks=data.get("remarks"),
            createdById=user.get("id"),
        )
        self.db.add(delivery)
        self.db.flush()
        self._history(delivery.id, None, DeliveryStatus.SCHEDULED.value, user.get("id"), "Booked by distributor")
        self._generate_qr(delivery)
        self.db.commit()
        delivery = self.db.get(InboundDelivery, delivery.id)
        if delivery:
            self.db.refresh(delivery)

        NotificationsService(self.db).notify_on_scheduled_delivery(delivery)

        result = self._serialize(delivery, full=True)
        result["qr"] = self._qr_payload(delivery)
        return result

    def list_today_deliveries(self, user: dict, branch_id: str | None = None) -> dict:
        from sqlalchemy import or_

        from app.utils.timezone import today_end_ist, today_start_ist

        branch = resolve_branch_filter(user, branch_id) or user.get("branchId")
        if not branch:
            raise bad_request("branchId is required")

        day_start = today_start_ist()
        day_end = today_end_ist()
        rows = (
            self.db.query(InboundDelivery)
            .filter(
                InboundDelivery.branchId == branch,
                InboundDelivery.isActive.is_(True),
                InboundDelivery.status.in_(
                    [
                        DeliveryStatus.SCHEDULED.value,
                        DeliveryStatus.ARRIVED_AT_GATE.value,
                        DeliveryStatus.GATE_VERIFIED.value,
                        DeliveryStatus.APPROVED.value,
                    ]
                ),
                or_(
                    (InboundDelivery.expectedArrivalTime >= day_start)
                    & (InboundDelivery.expectedArrivalTime < day_end),
                    InboundDelivery.expectedArrivalTime.is_(None),
                ),
            )
            .order_by(InboundDelivery.expectedArrivalTime.asc())
            .all()
        )
        return {"deliveries": [self._serialize_dashboard(d) for d in rows], "total": len(rows)}

    def _qr_payload(self, delivery: InboundDelivery) -> dict | None:
        if not delivery.qrCode:
            return None
        return {
            "qrPayload": delivery.qrCode.qrPayload,
            "signature": delivery.qrCode.signature,
            "expiresAt": delivery.qrCode.expiresAt.isoformat(),
        }

    def _gate_timing_fields(self, delivery_id: str) -> dict:
        from app.models.delivery_entities import DeliveryGateEntry, DeliveryGateExit

        entry = (
            self.db.query(DeliveryGateEntry)
            .filter(DeliveryGateEntry.deliveryId == delivery_id)
            .order_by(DeliveryGateEntry.entryTime.asc())
            .first()
        )
        exit_row = (
            self.db.query(DeliveryGateExit)
            .filter(DeliveryGateExit.deliveryId == delivery_id)
            .order_by(DeliveryGateExit.exitTime.desc())
            .first()
        )
        entry_time = entry.entryTime if entry else None
        exit_time = exit_row.exitTime if exit_row else None
        duration_minutes = None
        if entry_time and exit_time:
            duration_minutes = max(0, int((exit_time - entry_time).total_seconds() // 60))
        return {
            "entryTime": entry_time.isoformat() if entry_time else None,
            "exitTime": exit_time.isoformat() if exit_time else None,
            "durationMinutes": duration_minutes,
            "gatePassNumber": entry.passNumber if entry else None,
        }

    def _serialize_dashboard(self, d: InboundDelivery) -> dict:
        branch = self.db.get(Branch, d.branchId)
        vendor = self.db.get(Distributor, d.vendorId)
        agent = self.db.get(DeliveryAgent, d.agentId)
        vehicle = self.db.get(DeliveryVehicle, d.vehicleId)
        base = self._serialize(d, full=True)
        base.update(
            {
                "goodsType": d.goodsType,
                "expectedArrivalTime": d.expectedArrivalTime.isoformat() if d.expectedArrivalTime else None,
                "vendorName": vendor.vendorName if vendor else None,
                "agentName": agent.name if agent else None,
                "agentPhone": agent.phone if agent else None,
                "vehicleNumber": vehicle.registrationNumber if vehicle else None,
                "branchName": branch.name if branch else None,
            }
        )
        return base

    def _deduct_wallet(self, vendor_id: str, amount: Decimal, delivery_id: str, user_id: str | None) -> None:
        wallet = self.db.query(VendorWallet).filter(VendorWallet.vendorId == vendor_id).first()
        if not wallet:
            wallet = VendorWallet(vendorId=vendor_id, balance=Decimal("0"))
            self.db.add(wallet)
            self.db.flush()
        if wallet.balance < amount:
            raise bad_request("Insufficient wallet balance")
        wallet.balance -= amount
        self.db.add(
            WalletTransaction(
                walletId=wallet.id,
                amount=-amount,
                transactionType="DEBIT",
                referenceType="DELIVERY",
                referenceId=delivery_id,
            )
        )

    def _generate_qr(self, delivery: InboundDelivery) -> None:
        payload = f"{delivery.id}:{delivery.deliveryNumber}:{now_ist().isoformat()}"
        secret = get_settings().jwt_secret
        signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        existing = delivery.qrCode
        if existing:
            existing.qrPayload = payload
            existing.signature = signature
            existing.expiresAt = now_ist() + timedelta(hours=48)
        else:
            self.db.add(
                DeliveryQrCode(
                    deliveryId=delivery.id,
                    qrPayload=payload,
                    signature=signature,
                    expiresAt=now_ist() + timedelta(hours=48),
                )
            )

    def transition_status(self, delivery_id: str, user: dict, new_status: str, remarks: str = "") -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery:
            raise not_found("Delivery")
        old = delivery.status
        if old == new_status:
            return self._serialize_dashboard(delivery)
        allowed = ALLOWED_TRANSITIONS.get(old)
        if allowed is None:
            raise bad_request(f"Unknown current status: {old}")
        if new_status not in allowed:
            raise bad_request(
                f"Cannot transition delivery from {old} to {new_status}. "
                f"Allowed: {', '.join(sorted(allowed)) or 'none'}"
            )
        delivery.status = new_status
        if new_status == DeliveryStatus.ARRIVED_AT_GATE.value:
            delivery.actualArrivalTime = now_ist()
        self._history(delivery.id, old, new_status, user.get("id"), remarks)
        self.db.commit()
        self.db.refresh(delivery)
        return self._serialize_dashboard(delivery)

    def dashboard_summary(self, user: dict, branch_id: str | None = None) -> dict:
        branch = resolve_branch_filter(user, branch_id)
        q = self.db.query(InboundDelivery).filter(InboundDelivery.isActive.is_(True))
        if branch:
            q = q.filter(InboundDelivery.branchId == branch)
        rows = q.all()
        by_status: dict[str, int] = {}
        for d in rows:
            by_status[d.status] = by_status.get(d.status, 0) + 1
        return {"total": len(rows), "byStatus": by_status}

    def _serialize(self, d: InboundDelivery, full: bool = False) -> dict:
        base = {
            "id": d.id,
            "deliveryNumber": d.deliveryNumber,
            "branchId": d.branchId,
            "vendorId": d.vendorId,
            "status": d.status,
            "deliveryType": d.deliveryType,
            "poNumber": d.poNumber,
            "expectedDeliveryDate": d.expectedDeliveryDate.isoformat() if d.expectedDeliveryDate else None,
            "createdAt": d.createdAt.isoformat() if d.createdAt else None,
        }
        if full:
            branch = self.db.get(Branch, d.branchId)
            vendor = self.db.get(Distributor, d.vendorId)
            agent = self.db.get(DeliveryAgent, d.agentId) if d.agentId else None
            vehicle = self.db.get(DeliveryVehicle, d.vehicleId) if d.vehicleId else None
            base.update(
                {
                    "vehicleId": d.vehicleId,
                    "agentId": d.agentId,
                    "slotId": d.slotId,
                    "goodsType": d.goodsType,
                    "invoiceNumber": d.invoiceNumber,
                    "totalBoxes": d.totalBoxes,
                    "remarks": d.remarks,
                    "expectedArrivalTime": d.expectedArrivalTime.isoformat() if d.expectedArrivalTime else None,
                    "actualArrivalTime": d.actualArrivalTime.isoformat() if d.actualArrivalTime else None,
                    "walletFee": float(d.walletFee or 0),
                    "items": [
                        {
                            "id": i.id,
                            "itemName": i.itemName,
                            "quantityOrdered": i.quantityOrdered,
                            "quantityReceived": i.quantityReceived,
                        }
                        for i in (d.items or [])
                    ],
                    "hasQr": d.qrCode is not None,
                    "qr": self._qr_payload(d),
                    "vendorName": vendor.vendorName if vendor else None,
                    "agentName": agent.name if agent else None,
                    "agentPhone": agent.phone if agent else None,
                    "vehicleNumber": vehicle.registrationNumber if vehicle else None,
                    "branchName": branch.name if branch else None,
                    **self._gate_timing_fields(d.id),
                }
            )
        return base
