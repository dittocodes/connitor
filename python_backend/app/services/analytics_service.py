from datetime import datetime, timedelta

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session, joinedload

from app.models import Branch, HospitalChain, User, Visit, Visitor
from app.models.enums import Role, VisitStatus


class AnalyticsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_system_overview(self) -> dict:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        visit_row = (
            self.db.query(
                func.sum(case((Visit.status == VisitStatus.CHECKED_IN.value, 1), else_=0)),
                func.sum(case((Visit.createdAt >= today, 1), else_=0)),
            )
            .select_from(Visit)
            .one()
        )
        return {
            "totalChains": self.db.query(func.count(HospitalChain.id)).scalar() or 0,
            "totalBranches": self.db.query(func.count(Branch.id)).scalar() or 0,
            "totalStaff": self.db.query(func.count(User.id))
            .filter(User.role == Role.STAFF.value)
            .scalar()
            or 0,
            "totalVisitors": self.db.query(func.count(Visitor.id)).scalar() or 0,
            "activeVisits": int(visit_row[0] or 0),
            "todayVisits": int(visit_row[1] or 0),
        }

    def _count_visits_range(self, start: datetime, end: datetime, branch_ids: list[str] | None = None) -> dict:
        filters = []
        if branch_ids is not None:
            filters.append(Visit.branchId.in_(branch_ids))

        visits_expr = func.sum(
            case((and_(Visit.createdAt >= start, Visit.createdAt <= end), 1), else_=0)
        )
        check_in_expr = func.sum(
            case(
                (
                    and_(
                        Visit.checkInTime.isnot(None),
                        Visit.checkInTime >= start,
                        Visit.checkInTime <= end,
                    ),
                    1,
                ),
                else_=0,
            )
        )
        check_out_expr = func.sum(
            case(
                (
                    and_(
                        Visit.checkOutTime.isnot(None),
                        Visit.checkOutTime >= start,
                        Visit.checkOutTime <= end,
                    ),
                    1,
                ),
                else_=0,
            )
        )
        q = self.db.query(visits_expr, check_in_expr, check_out_expr).select_from(Visit)
        if filters:
            q = q.filter(*filters)
        visits, check_ins, check_outs = q.one()
        return {
            "visits": int(visits or 0),
            "checkIns": int(check_ins or 0),
            "checkOuts": int(check_outs or 0),
        }

    def get_visitor_trends(self, period: str = "weekly", branch_ids: list[str] | None = None) -> dict:
        now = datetime.utcnow()
        data = []
        if period == "daily":
            for i in range(6, -1, -1):
                start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                end = start + timedelta(days=1) - timedelta(seconds=1)
                point = self._count_visits_range(start, end, branch_ids)
                point["label"] = start.strftime("%a %d")
                data.append(point)
        elif period == "weekly":
            for i in range(3, -1, -1):
                end = now - timedelta(days=i * 7)
                start = (end - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
                point = self._count_visits_range(start, end, branch_ids)
                point["label"] = f"Week {4 - i}"
                data.append(point)
        elif period == "monthly":
            for i in range(5, -1, -1):
                month = now.month - i
                year = now.year
                while month <= 0:
                    month += 12
                    year -= 1
                start = datetime(year, month, 1)
                if month == 12:
                    end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
                else:
                    end = datetime(year, month + 1, 1) - timedelta(seconds=1)
                point = self._count_visits_range(start, end, branch_ids)
                point["label"] = start.strftime("%b")
                data.append(point)
        else:
            for i in range(4, -1, -1):
                year = now.year - i
                start = datetime(year, 1, 1)
                end = datetime(year, 12, 31, 23, 59, 59)
                point = self._count_visits_range(start, end, branch_ids)
                point["label"] = str(year)
                data.append(point)
        return {"period": period, "data": data}

    def get_visit_status_distribution(self) -> list[dict]:
        rows = (
            self.db.query(Visit.status, func.count(Visit.id))
            .group_by(Visit.status)
            .all()
        )
        counts = {status: count for status, count in rows}
        return [{"status": s.value, "count": counts.get(s.value, 0)} for s in VisitStatus]

    def get_visit_category_distribution(self) -> list[dict]:
        rows = (
            self.db.query(Visit.visitCategory, func.count(Visit.id))
            .group_by(Visit.visitCategory)
            .all()
        )
        counts = {cat: count for cat, count in rows if cat}
        return [
            {"category": "Meeting", "count": counts.get("MEETING", 0)},
            {"category": "Delivery", "count": counts.get("DELIVERY", 0)},
        ]

    def get_user_role_distribution(self) -> list[dict]:
        rows = self.db.query(User.role, func.count(User.id)).group_by(User.role).all()
        counts = {role: count for role, count in rows}
        return [{"role": r.value, "count": counts.get(r.value, 0)} for r in Role]

    def get_all_chains_with_stats(self) -> list[dict]:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        chains = self.db.query(HospitalChain).all()
        if not chains:
            return []

        chain_ids = [c.id for c in chains]
        branch_counts = dict(
            self.db.query(Branch.hospitalChainId, func.count(Branch.id))
            .filter(Branch.hospitalChainId.in_(chain_ids))
            .group_by(Branch.hospitalChainId)
            .all()
        )
        staff_counts = dict(
            self.db.query(User.hospitalChainId, func.count(User.id))
            .filter(User.hospitalChainId.in_(chain_ids), User.role == Role.STAFF.value)
            .group_by(User.hospitalChainId)
            .all()
        )
        visitor_counts = dict(
            self.db.query(Branch.hospitalChainId, func.count(Visitor.id))
            .join(Visitor, Visitor.branchId == Branch.id)
            .filter(Branch.hospitalChainId.in_(chain_ids))
            .group_by(Branch.hospitalChainId)
            .all()
        )
        active_visits = dict(
            self.db.query(Branch.hospitalChainId, func.count(Visit.id))
            .join(Visit, Visit.branchId == Branch.id)
            .filter(
                Branch.hospitalChainId.in_(chain_ids),
                Visit.status == VisitStatus.CHECKED_IN.value,
            )
            .group_by(Branch.hospitalChainId)
            .all()
        )
        today_visits = dict(
            self.db.query(Branch.hospitalChainId, func.count(Visit.id))
            .join(Visit, Visit.branchId == Branch.id)
            .filter(Branch.hospitalChainId.in_(chain_ids), Visit.createdAt >= today)
            .group_by(Branch.hospitalChainId)
            .all()
        )

        return [
            {
                "chainId": chain.id,
                "chainName": chain.name,
                "totalBranches": branch_counts.get(chain.id, 0),
                "totalStaff": staff_counts.get(chain.id, 0),
                "totalVisitors": visitor_counts.get(chain.id, 0),
                "activeVisits": active_visits.get(chain.id, 0),
                "todayVisits": today_visits.get(chain.id, 0),
            }
            for chain in chains
        ]

    def get_chain_stats(self, chain_id: str) -> dict:
        stats = self.get_all_chains_with_stats()
        for item in stats:
            if item["chainId"] == chain_id:
                return item
        raise ValueError("Chain not found")

    def get_branch_stats(self, branch_id: str) -> dict:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        branch = self.db.get(Branch, branch_id)
        if not branch:
            raise ValueError("Branch not found")
        return {
            "branchId": branch_id,
            "branchName": branch.name,
            "totalStaff": self.db.query(User)
            .filter(User.branchId == branch_id, User.role == Role.STAFF.value)
            .count(),
            "totalVisitors": self.db.query(Visitor).filter(Visitor.branchId == branch_id).count(),
            "activeVisits": self.db.query(Visit)
            .filter(Visit.branchId == branch_id, Visit.status == VisitStatus.CHECKED_IN.value)
            .count(),
            "todayVisits": self.db.query(Visit)
            .filter(Visit.branchId == branch_id, Visit.createdAt >= today)
            .count(),
        }

    def get_all_branches_with_stats(self) -> list[dict]:
        return [self.get_branch_stats(b.id) for b in self.db.query(Branch).all()]

    def get_chain_growth(self) -> dict:
        now = datetime.utcnow()
        data = []
        for i in range(5, -1, -1):
            month = now.month - i
            year = now.year
            while month <= 0:
                month += 12
                year -= 1
            start = datetime(year, month, 1)
            if month == 12:
                end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
            else:
                end = datetime(year, month + 1, 1) - timedelta(seconds=1)
            count = (
                self.db.query(HospitalChain)
                .filter(HospitalChain.createdAt >= start, HospitalChain.createdAt <= end)
                .count()
            )
            data.append({"label": start.strftime("%b"), "count": count})
        return {"period": "monthly", "data": data}

    def get_branch_growth(self) -> dict:
        now = datetime.utcnow()
        data = []
        for i in range(5, -1, -1):
            month = now.month - i
            year = now.year
            while month <= 0:
                month += 12
                year -= 1
            start = datetime(year, month, 1)
            if month == 12:
                end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
            else:
                end = datetime(year, month + 1, 1) - timedelta(seconds=1)
            count = (
                self.db.query(Branch)
                .filter(Branch.createdAt >= start, Branch.createdAt <= end)
                .count()
            )
            data.append({"label": start.strftime("%b"), "count": count})
        return {"period": "monthly", "data": data}

    def get_chain_visitor_trends(self, chain_id: str, period: str = "weekly") -> dict:
        branch_ids = [
            b.id
            for b in self.db.query(Branch).filter(Branch.hospitalChainId == chain_id).all()
        ]
        return self.get_visitor_trends(period, branch_ids or None)

    def get_chain_branches_with_stats(self, chain_id: str) -> list[dict]:
        branches = self.db.query(Branch).filter(Branch.hospitalChainId == chain_id).all()
        return [self.get_branch_stats(b.id) for b in branches]

    def get_branch_visitor_trends(self, branch_id: str, period: str = "hourly") -> dict:
        return self.get_visitor_trends(period, [branch_id])
