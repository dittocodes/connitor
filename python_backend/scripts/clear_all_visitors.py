"""
Delete all rows from Visitor and dependent visit data.

Order: notifications → slot bookings → visits → visitors.

Usage:
  python scripts/clear_all_visitors.py --yes
"""
from __future__ import annotations

import argparse

from sqlalchemy import text

from app.database import SessionLocal


def clear_all(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        visitor_count = db.execute(text("SELECT COUNT(*) FROM Visitor")).scalar() or 0
        visit_count = db.execute(text("SELECT COUNT(*) FROM Visit")).scalar() or 0
        print(f"Before: Visitor={visitor_count}, Visit={visit_count}")

        if dry_run:
            print("Dry run — no changes made.")
            return

        notif_deleted = db.execute(
            text("DELETE FROM Notification WHERE visitId IS NOT NULL")
        ).rowcount
        slots_reset = db.execute(
            text(
                """
                UPDATE DoctorAvailabilitySlot
                SET isBooked = 0, visitId = NULL
                WHERE visitId IS NOT NULL OR isBooked = 1
                """
            )
        ).rowcount
        visits_deleted = db.execute(text("DELETE FROM Visit")).rowcount
        visitors_deleted = db.execute(text("DELETE FROM Visitor")).rowcount

        db.commit()

        remaining = db.execute(text("SELECT COUNT(*) FROM Visitor")).scalar() or 0
        print(
            f"Deleted: {notif_deleted} notification(s), "
            f"reset {slots_reset} slot(s), "
            f"{visits_deleted} visit(s), "
            f"{visitors_deleted} visitor(s)."
        )
        print(f"After: Visitor={remaining}")
        if remaining != 0:
            raise RuntimeError("Visitor table is not empty after cleanup.")
        print("Visitor table cleared successfully.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    if not args.dry_run and not args.yes:
        parser.error("Pass --dry-run or --yes to confirm")
    clear_all(args.dry_run)


if __name__ == "__main__":
    main()
