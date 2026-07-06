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
from app.delivery.utils import bad_request, not_found, resolve_branch_filter
from app.models.delivery_entities import (
    DeliveryNumberSequence,
    DeliveryQrCode,
    DeliverySecurityScan,
    InboundDelivery,
    InboundDeliveryItem,
    InboundDeliveryStatusHistory,
    VendorWallet,
    WalletTransaction,
)
from app.models.enums import DeliveryStatus, DeliveryType
from app.utils.timezone import now_ist

EDITABLE = {DeliveryStatus.DRAFT.value, DeliveryStatus.SCHEDULED.value}


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
        return {"total": total, "items": [self._serialize(d) for d in rows]}

    def get_delivery(self, delivery_id: str, user: dict) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery or not delivery.isActive:
            raise not_found("Delivery")
        return self._serialize(delivery, full=True)

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
        delivery.walletFee = Decimal(str(delivery.walletFee or 0)) + Decimal("100")
        self._deduct_wallet(delivery.vendorId, delivery.walletFee, delivery.id, user.get("id"))
        self._generate_qr(delivery)
        self._history(delivery.id, old, delivery.status, user.get("id"), "Scheduled")
        self.db.commit()
        self.db.refresh(delivery)
        return self._serialize(delivery, full=True)

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
        delivery.status = new_status
        if new_status == DeliveryStatus.ARRIVED_AT_GATE.value:
            delivery.actualArrivalTime = now_ist()
        self._history(delivery.id, old, new_status, user.get("id"), remarks)
        self.db.commit()
        self.db.refresh(delivery)
        return self._serialize(delivery, full=True)

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
            base.update(
                {
                    "vehicleId": d.vehicleId,
                    "agentId": d.agentId,
                    "invoiceNumber": d.invoiceNumber,
                    "totalBoxes": d.totalBoxes,
                    "remarks": d.remarks,
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
                }
            )
        return base
