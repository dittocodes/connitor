from fastapi import APIRouter

from app.routers import (
    all_branches,
    analytics,
    appointments,
    attendant_passes,
    auth,
    branches,
    delivery,
    departments,
    hospital_chains,
    notifications,
    public_appointment_approval,
    public_appointments,
    public_registration,
    public_visitors,
    public_visits,
    root,
    security,
    staff,
    sub_departments,
    twilio_webhooks,
    users,
    visitor_portal,
    visitor_accounts,
    visitor_auth,
    visitors,
    whatsapp_webhooks,
    zoom_webhooks,
)
from app.config import get_settings

api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(hospital_chains.router, prefix="/hospital-chains", tags=["hospital-chains"])
api_router.include_router(branches.router, prefix="/chain/{chain_id}/branches", tags=["branches"])
api_router.include_router(all_branches.router, prefix="/branches", tags=["branches"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(sub_departments.router, prefix="/sub-departments", tags=["sub-departments"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(public_appointments.router, prefix="/public/appointments", tags=["public-appointments"])
api_router.include_router(
    public_appointment_approval.router,
    prefix="/public/appointment-approval",
    tags=["appointment-approval"],
)
api_router.include_router(visitor_portal.router, prefix="/public/visitor-portal", tags=["visitor-portal"])
api_router.include_router(visitor_accounts.router, prefix="/public/visitor-accounts", tags=["visitor-accounts"])
api_router.include_router(visitor_auth.router, prefix="/public/visitor-auth", tags=["visitor-auth"])
api_router.include_router(
    appointments.router,
    prefix="/appointments",
    tags=["appointments"],
    dependencies=[],
)
api_router.include_router(staff.router, prefix="/staff", tags=["staff"])
api_router.include_router(security.router, prefix="/security", tags=["security"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(visitors.router, prefix="/visitors", tags=["visitors"])
api_router.include_router(public_registration.router, prefix="/public/registration", tags=["public-registration"])
api_router.include_router(public_visitors.router, prefix="/public/visitors", tags=["public-visitors"])
api_router.include_router(public_visits.router, prefix="/public/visits", tags=["public-visits"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(zoom_webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(twilio_webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(whatsapp_webhooks.router, prefix="/webhooks", tags=["webhooks"])

_settings = get_settings()
if _settings.delivery_module_enabled:
    api_router.include_router(delivery.router, prefix="/delivery", tags=["delivery"])
    api_router.include_router(attendant_passes.router, prefix="/attendant-passes", tags=["attendant-passes"])
