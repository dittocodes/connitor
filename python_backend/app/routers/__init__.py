from fastapi import APIRouter

from app.routers import (
    all_branches,
    analytics,
    auth,
    branches,
    hospital_chains,
    notifications,
    public_registration,
    public_visitors,
    public_visits,
    root,
    security,
    staff,
    users,
    visitors,
)

api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(hospital_chains.router, prefix="/hospital-chains", tags=["hospital-chains"])
api_router.include_router(branches.router, prefix="/chain/{chain_id}/branches", tags=["branches"])
api_router.include_router(all_branches.router, prefix="/branches", tags=["branches"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(staff.router, prefix="/staff", tags=["staff"])
api_router.include_router(security.router, prefix="/security", tags=["security"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(visitors.router, prefix="/visitors", tags=["visitors"])
api_router.include_router(public_registration.router, prefix="/public/registration", tags=["public-registration"])
api_router.include_router(public_visitors.router, prefix="/public/visitors", tags=["public-visitors"])
api_router.include_router(public_visits.router, prefix="/public/visits", tags=["public-visits"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
