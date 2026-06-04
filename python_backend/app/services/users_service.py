from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Branch, HospitalChain, User
from app.models.enums import Role
from app.utils.serializers import model_to_dict


class UsersService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def find_staff_by_branch(self, branch_id: str) -> list[dict]:
        if not branch_id or not branch_id.strip():
            raise HTTPException(status_code=400, detail="Branch ID is required.")
        staff = (
            self.db.query(User)
            .filter(User.branchId == branch_id, User.role == Role.STAFF.value)
            .all()
        )
        return [
            {
                "id": s.id,
                "name": s.name,
                "phone": s.phone,
                "userType": s.userType,
                "department": s.department,
            }
            for s in staff
        ]

    def get_departments_by_branch(self, branch_id: str) -> list[str | None]:
        rows = (
            self.db.query(User.department)
            .filter(User.branchId == branch_id, User.department.isnot(None))
            .distinct()
            .all()
        )
        return [r[0] for r in rows]

    def find_staff_by_department(self, branch_id: str, department: str) -> dict:
        staff = (
            self.db.query(User)
            .filter(
                User.branchId == branch_id,
                User.department == department,
                User.role == Role.STAFF.value,
            )
            .all()
        )
        return {
            "staff": [
                {"id": s.id, "name": s.name, "phone": s.phone, "userType": s.userType}
                for s in staff
            ]
        }

    def search_staff(self, branch_id: str, query: str, department: str | None = None) -> dict:
        if not branch_id or not branch_id.strip():
            raise HTTPException(status_code=400, detail="Branch ID is required.")
        q = self.db.query(User).filter(User.branchId == branch_id, User.role == Role.STAFF.value)
        if query and len(query.strip()) >= 2:
            q = q.filter(User.name.contains(query.strip()))
        if department and department != "all":
            q = q.filter(User.department == department)
        staff = q.order_by(User.name).limit(50).all()
        return {
            "staff": [
                {
                    "id": s.id,
                    "name": s.name,
                    "email": s.email,
                    "phone": s.phone,
                    "department": s.department,
                }
                for s in staff
            ],
            "total": len(staff),
        }

    def _check_scope(self, req_user: dict, target: User) -> None:
        if req_user["role"] == Role.CHAIN_ADMIN.value and target.hospitalChainId != req_user.get("hospitalChainId"):
            raise HTTPException(status_code=403, detail="You can only operate within your own chain.")
        if req_user["role"] == Role.BRANCH_ADMIN.value and target.branchId != req_user.get("branchId"):
            raise HTTPException(status_code=403, detail="You can only operate within your own branch.")

    def create(self, data: dict, req_user: dict) -> dict:
        role = data["role"]
        if role == Role.CHAIN_ADMIN.value and req_user["role"] != Role.SUPER_ADMIN.value:
            raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can create CHAIN_ADMIN.")
        if role == Role.BRANCH_ADMIN.value and req_user["role"] not in (
            Role.SUPER_ADMIN.value,
            Role.CHAIN_ADMIN.value,
        ):
            raise HTTPException(status_code=403, detail="Only SUPER_ADMIN or CHAIN_ADMIN can create BRANCH_ADMIN.")
        if role == Role.BRANCH_ADMIN.value and not data.get("branchId"):
            raise HTTPException(status_code=400, detail="BRANCH_ADMIN must be associated with a branch.")
        if role in (Role.STAFF.value, Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value):
            if req_user["role"] == Role.CHAIN_ADMIN.value and data.get("hospitalChainId") != req_user.get("hospitalChainId"):
                raise HTTPException(status_code=403, detail="You can only create users in your own chain.")
            if req_user["role"] == Role.BRANCH_ADMIN.value and data.get("branchId") != req_user.get("branchId"):
                raise HTTPException(status_code=403, detail="You can only create users in your own branch.")

        existing = (
            self.db.query(User)
            .filter((User.phone == data["phone"]) | (User.email == data.get("email")))
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="User with this phone or email already exists.")

        if not self.db.get(HospitalChain, data["hospitalChainId"]):
            raise HTTPException(status_code=400, detail="Invalid hospitalChainId.")
        if data.get("branchId") and not self.db.get(Branch, data["branchId"]):
            raise HTTPException(status_code=400, detail="Invalid branchId.")

        user = User(**{**data, "isActive": True})
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return model_to_dict(user)

    def find_all(self, filters: dict, req_user: dict) -> list[dict]:
        q = self.db.query(User)
        if req_user["role"] == Role.CHAIN_ADMIN.value:
            q = q.filter(User.hospitalChainId == req_user.get("hospitalChainId"))
        if req_user["role"] == Role.BRANCH_ADMIN.value:
            q = q.filter(User.branchId == req_user.get("branchId"))
        if filters.get("role"):
            q = q.filter(User.role == filters["role"])
        if filters.get("isActive") is not None:
            q = q.filter(User.isActive == filters["isActive"])
        else:
            q = q.filter(User.isActive == True)  # noqa: E712
        if filters.get("branchId"):
            q = q.filter(User.branchId == filters["branchId"])
        if filters.get("department"):
            q = q.filter(User.department == filters["department"])
        if filters.get("chainId"):
            q = q.filter(User.hospitalChainId == filters["chainId"])
        return [model_to_dict(u) for u in q.all()]

    def find_one(self, user_id: str, req_user: dict) -> dict:
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        self._check_scope(req_user, user)
        return model_to_dict(user)

    def update(self, user_id: str, data: dict, req_user: dict) -> dict:
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        self._check_scope(req_user, user)
        for key, value in data.items():
            if value is not None:
                setattr(user, key, value)
        self.db.commit()
        self.db.refresh(user)
        return model_to_dict(user)

    def remove(self, user_id: str, req_user: dict) -> dict:
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        self._check_scope(req_user, user)
        user.isActive = False
        self.db.commit()
        return model_to_dict(user)
