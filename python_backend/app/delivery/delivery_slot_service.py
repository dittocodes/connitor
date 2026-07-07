"""Branch delivery slot management."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.delivery.utils import bad_request, not_found
from app.models import Branch
from app.models.delivery_entities import BranchDeliverySlot
from app.utils.timezone import ist_day_bounds, now_ist, parse_to_ist_naive


class DeliverySlotService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _assert_branch_access(self, user: dict, branch_id: str) -> None:
        role = user.get("role") or ""
        if role == "SUPER_ADMIN":
            return
        if role in ("HOSPITAL_ADMIN", "BRANCH_ADMIN", "SECURITY", "SECURITY_SUPERVISOR", "DISTRIBUTOR"):
            if user.get("branchId") and user["branchId"] != branch_id and role != "DISTRIBUTOR":
                raise bad_request("You can only access slots for your branch")
            return
        if role == "DISTRIBUTOR":
            return
        raise bad_request("Not authorized for this branch")

    def list_slots(self, branch_id: str, user: dict, *, slot_date: date | None = None) -> dict:
        self._assert_branch_access(user, branch_id)
        day = slot_date or now_ist().date()
        day_start, day_end = ist_day_bounds(day)
        rows = (
            self.db.query(BranchDeliverySlot)
            .filter(
                BranchDeliverySlot.branchId == branch_id,
                BranchDeliverySlot.isActive.is_(True),
                BranchDeliverySlot.slotStart >= day_start,
                BranchDeliverySlot.slotStart < day_end,
                BranchDeliverySlot.slotStart > now_ist(),
            )
            .order_by(BranchDeliverySlot.slotStart.asc())
            .all()
        )
        return {
            "date": day.isoformat(),
            "slots": [self._serialize_slot(s) for s in rows if s.bookedCount < s.maxDeliveries],
        }

    def bulk_create_slots(self, branch_id: str, user: dict, data: dict) -> dict:
        self._assert_branch_access(user, branch_id)
        branch = self.db.get(Branch, branch_id)
        if not branch:
            raise not_found("Branch")

        start_date = date.fromisoformat(data["startDate"])
        end_date = date.fromisoformat(data["endDate"])
        if end_date < start_date:
            raise bad_request("endDate must be on or after startDate")

        windows = data.get("windows") or [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "17:00"}]
        slot_minutes = int(data.get("slotMinutes") or 60)
        max_deliveries = int(data.get("maxDeliveries") or 1)
        created = 0
        cursor = start_date
        while cursor <= end_date:
            if cursor.weekday() != 6:  # skip Sunday
                for window in windows:
                    start_h, start_m = map(int, window["start"].split(":"))
                    end_h, end_m = map(int, window["end"].split(":"))
                    slot_start = datetime.combine(cursor, datetime.min.time()).replace(
                        hour=start_h, minute=start_m
                    )
                    window_end = datetime.combine(cursor, datetime.min.time()).replace(
                        hour=end_h, minute=end_m
                    )
                    while slot_start + timedelta(minutes=slot_minutes) <= window_end:
                        slot_end = slot_start + timedelta(minutes=slot_minutes)
                        exists = (
                            self.db.query(BranchDeliverySlot)
                            .filter(
                                BranchDeliverySlot.branchId == branch_id,
                                BranchDeliverySlot.slotStart == slot_start,
                            )
                            .first()
                        )
                        if not exists:
                            self.db.add(
                                BranchDeliverySlot(
                                    branchId=branch_id,
                                    slotStart=slot_start,
                                    slotEnd=slot_end,
                                    maxDeliveries=max_deliveries,
                                    bookedCount=0,
                                    isActive=True,
                                )
                            )
                            created += 1
                        slot_start = slot_end
            cursor += timedelta(days=1)

        self.db.commit()
        return {"created": created, "branchId": branch_id}

    def update_slot(self, slot_id: str, user: dict, data: dict) -> dict:
        slot = self.db.get(BranchDeliverySlot, slot_id)
        if not slot:
            raise not_found("Slot")
        self._assert_branch_access(user, slot.branchId)
        if slot.bookedCount > 0 and data.get("isActive") is False:
            raise bad_request("Cannot disable a slot with active bookings")
        if "maxDeliveries" in data:
            max_d = int(data["maxDeliveries"])
            if max_d < slot.bookedCount:
                raise bad_request("maxDeliveries cannot be less than bookedCount")
            slot.maxDeliveries = max_d
        if "isActive" in data:
            slot.isActive = bool(data["isActive"])
        self.db.commit()
        return self._serialize_slot(slot)

    def delete_slot(self, slot_id: str, user: dict) -> dict:
        slot = self.db.get(BranchDeliverySlot, slot_id)
        if not slot:
            raise not_found("Slot")
        self._assert_branch_access(user, slot.branchId)
        if slot.bookedCount > 0:
            raise bad_request("Cannot delete a slot with bookings")
        slot.isActive = False
        self.db.commit()
        return {"id": slot_id, "deleted": True}

    def reserve_slot(self, slot_id: str) -> BranchDeliverySlot:
        slot = self.db.get(BranchDeliverySlot, slot_id)
        if not slot or not slot.isActive:
            raise bad_request("Delivery slot not available")
        if slot.bookedCount >= slot.maxDeliveries:
            raise bad_request("Delivery slot is fully booked")
        if slot.slotStart <= now_ist():
            raise bad_request("Delivery slot has already started")
        slot.bookedCount += 1
        self.db.flush()
        return slot

    @staticmethod
    def _serialize_slot(slot: BranchDeliverySlot) -> dict:
        remaining = max(0, slot.maxDeliveries - slot.bookedCount)
        return {
            "id": slot.id,
            "branchId": slot.branchId,
            "slotStart": slot.slotStart.isoformat(),
            "slotEnd": slot.slotEnd.isoformat(),
            "maxDeliveries": slot.maxDeliveries,
            "bookedCount": slot.bookedCount,
            "remaining": remaining,
            "isActive": slot.isActive,
        }
