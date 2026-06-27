"""Update a doctor's phone number in User and related Visit.staffPhone."""
from sqlalchemy import text

from app.database import SessionLocal

DOCTOR_NAME = "Mohan Gola Agra"
NEW_PHONE = "7676283924"


def main() -> None:
    db = SessionLocal()
    try:
        doctor = (
            db.execute(
                text(
                    "SELECT id, name, phone, role FROM User "
                    "WHERE name = :name AND role = 'STAFF'"
                ),
                {"name": DOCTOR_NAME},
            )
            .mappings()
            .first()
        )
        if not doctor:
            print(f"Doctor not found: {DOCTOR_NAME}")
            return

        doctor_id = doctor["id"]
        print(f"Found: {doctor['name']} ({doctor_id})")
        print(f"Old phone: {doctor['phone']}")

        db.execute(
            text("UPDATE User SET phone = :phone WHERE id = :id"),
            {"phone": NEW_PHONE, "id": doctor_id},
        )
        visit_count = db.execute(
            text("UPDATE Visit SET staffPhone = :phone WHERE staffId = :id"),
            {"phone": NEW_PHONE, "id": doctor_id},
        ).rowcount
        db.commit()

        updated = (
            db.execute(
                text("SELECT name, phone FROM User WHERE id = :id"),
                {"id": doctor_id},
            )
            .mappings()
            .first()
        )
        print(f"New phone: {updated['phone']}")
        print(f"Updated {visit_count} visit(s) staffPhone")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
