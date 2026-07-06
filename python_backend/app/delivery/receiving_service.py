"""Receiving dock and GRN operations."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.delivery.inbound_delivery_service import InboundDeliveryService
from app.delivery.utils import bad_request, not_found
from app.models.delivery_entities import DockAssignment, GrnRecord, InboundDelivery, ReceivingDock, ReceivingRecord
from app.models.enums import DeliveryStatus
from app.utils.timezone import now_ist


class ReceivingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.delivery_svc = InboundDeliveryService(db)

    def assign_dock(self, user: dict, delivery_id: str, dock_id: str) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery:
            raise not_found("Delivery")
        dock = self.db.get(ReceivingDock, dock_id)
        if not dock or not dock.isActive:
            raise not_found("Dock")
        self.db.add(DockAssignment(deliveryId=delivery_id, dockId=dock_id))
        self.delivery_svc.transition_status(
            delivery_id, user, DeliveryStatus.IN_PROGRESS.value, f"Dock {dock.dockCode} assigned"
        )
        return {"deliveryId": delivery_id, "dockId": dock_id}

    def start_receiving(self, user: dict, delivery_id: str) -> dict:
        record = self.db.query(ReceivingRecord).filter(ReceivingRecord.deliveryId == delivery_id).first()
        if not record:
            record = ReceivingRecord(deliveryId=delivery_id, status="IN_PROGRESS", startedAt=now_ist())
            self.db.add(record)
        else:
            record.status = "IN_PROGRESS"
            record.startedAt = now_ist()
        self.db.commit()
        return {"deliveryId": delivery_id, "status": record.status}

    def generate_grn(self, user: dict, delivery_id: str) -> dict:
        delivery = self.db.get(InboundDelivery, delivery_id)
        if not delivery:
            raise not_found("Delivery")
        existing = self.db.query(GrnRecord).filter(GrnRecord.deliveryId == delivery_id).first()
        if existing:
            return {"grnNumber": existing.grnNumber, "id": existing.id}
        grn_number = f"GRN-{now_ist().year}-{delivery.deliveryNumber[-6:]}"
        grn = GrnRecord(
            deliveryId=delivery_id,
            grnNumber=grn_number,
            generatedById=user["id"],
        )
        self.db.add(grn)
        self.delivery_svc.transition_status(
            delivery_id, user, DeliveryStatus.RECEIVED.value, "GRN generated"
        )
        self.db.commit()
        return {"grnNumber": grn_number, "deliveryId": delivery_id}

    def list_docks(self, branch_id: str) -> list[dict]:
        rows = (
            self.db.query(ReceivingDock)
            .filter(ReceivingDock.branchId == branch_id, ReceivingDock.isActive.is_(True))
            .all()
        )
        return [
            {"id": d.id, "dockName": d.dockName, "dockCode": d.dockCode, "branchId": d.branchId}
            for d in rows
        ]
