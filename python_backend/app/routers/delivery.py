"""Delivery management API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.permissions import require_permission
from app.delivery.branch_delivery_service import BranchDeliveryService
from app.delivery.distributor_service import DistributorService
from app.delivery.gate_service import DeliveryGateService
from app.delivery.inbound_delivery_service import InboundDeliveryService
from app.delivery.receiving_service import ReceivingService
from app.delivery.wallet_service import WalletService

router = APIRouter()


class DeliveryCreateBody(BaseModel):
    branchId: str | None = None
    vendorId: str | None = None
    vehicleId: str
    agentId: str
    deliveryType: str = "STANDARD"
    poNumber: str | None = None
    invoiceNumber: str | None = None
    totalBoxes: int = 0
    remarks: str | None = None
    items: list[dict] = Field(default_factory=list)


class DistributorCreateBody(BaseModel):
    vendorName: str
    vendorType: str = "MEDICAL"
    gstNumber: str | None = None
    email: str | None = None
    phone: str | None = None
    branchId: str | None = None


class ScanQrBody(BaseModel):
    qrPayload: str
    signature: str


class CourierRegisterBody(BaseModel):
    branchId: str
    agentName: str | None = None
    mobileNumber: str | None = None
    vehicleNumber: str | None = None
    courierCompany: str | None = None
    visitId: str | None = None


@router.get("/deliveries")
def list_deliveries(
    user: Annotated[dict, Depends(require_permission("VIEW_DELIVERY"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return InboundDeliveryService(db).list_deliveries(user, branch_id=branchId, status=status, skip=skip, limit=limit)


@router.get("/deliveries/dashboard/summary")
def delivery_dashboard(
    user: Annotated[dict, Depends(require_permission("VIEW_DELIVERY"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str | None = Query(None),
):
    return InboundDeliveryService(db).dashboard_summary(user, branchId)


@router.get("/deliveries/{delivery_id}")
def get_delivery(
    delivery_id: str,
    user: Annotated[dict, Depends(require_permission("VIEW_DELIVERY"))],
    db: Annotated[Session, Depends(get_db)],
):
    return InboundDeliveryService(db).get_delivery(delivery_id, user)


@router.post("/deliveries", status_code=201)
def create_delivery(
    body: DeliveryCreateBody,
    user: Annotated[dict, Depends(require_permission("CREATE_DELIVERY"))],
    db: Annotated[Session, Depends(get_db)],
):
    return InboundDeliveryService(db).create_delivery(user, body.model_dump())


@router.post("/deliveries/{delivery_id}/schedule")
def schedule_delivery(
    delivery_id: str,
    user: Annotated[dict, Depends(require_permission("CREATE_DELIVERY"))],
    db: Annotated[Session, Depends(get_db)],
):
    return InboundDeliveryService(db).schedule_delivery(delivery_id, user)


@router.get("/distributors")
def list_distributors(
    user: Annotated[dict, Depends(require_permission("VIEW_VENDOR"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return DistributorService(db).list_distributors(branchId, skip, limit)


@router.post("/distributors", status_code=201)
def create_distributor(
    body: DistributorCreateBody,
    user: Annotated[dict, Depends(require_permission("CREATE_VENDOR"))],
    db: Annotated[Session, Depends(get_db)],
):
    return DistributorService(db).create_distributor(user, body.model_dump())


@router.post("/security/scan-qr")
def scan_qr(
    body: ScanQrBody,
    user: Annotated[dict, Depends(require_permission("SCAN_QR"))],
    db: Annotated[Session, Depends(get_db)],
):
    return DeliveryGateService(db).scan_qr(user, body.qrPayload, body.signature)


@router.post("/security/allow-entry/{delivery_id}")
def allow_entry(
    delivery_id: str,
    user: Annotated[dict, Depends(require_permission("ALLOW_ENTRY"))],
    db: Annotated[Session, Depends(get_db)],
    gateId: str | None = Query(None),
):
    return DeliveryGateService(db).allow_entry(user, delivery_id, gateId)


@router.post("/security/mark-exit/{delivery_id}")
def mark_exit(
    delivery_id: str,
    user: Annotated[dict, Depends(require_permission("MARK_EXIT"))],
    db: Annotated[Session, Depends(get_db)],
):
    return DeliveryGateService(db).mark_exit(user, delivery_id)


@router.post("/security/courier/register", status_code=201)
def register_courier(
    body: CourierRegisterBody,
    user: Annotated[dict, Depends(require_permission("ALLOW_ENTRY"))],
    db: Annotated[Session, Depends(get_db)],
):
    return DeliveryGateService(db).register_courier(user, body.model_dump())


@router.get("/security/queue")
def unified_queue(
    user: Annotated[dict, Depends(require_permission("VIEW_SECURITY_DASHBOARD"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str = Query(...),
):
    return DeliveryGateService(db).unified_queue(user, branchId)


@router.get("/branch-settings/{branch_id}")
def get_branch_settings(
    branch_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return BranchDeliveryService(db).get_settings(branch_id)


@router.put("/branch-settings/{branch_id}")
def update_branch_settings(
    branch_id: str,
    body: dict,
    user: Annotated[dict, Depends(require_permission("VIEW_DELIVERY"))],
    db: Annotated[Session, Depends(get_db)],
):
    return BranchDeliveryService(db).update_settings(branch_id, body)


@router.get("/docks")
def list_docks(
    user: Annotated[dict, Depends(require_permission("VIEW_RECEIVING"))],
    db: Annotated[Session, Depends(get_db)],
    branchId: str = Query(...),
):
    return ReceivingService(db).list_docks(branchId)


@router.post("/receiving/assign-dock")
def assign_dock(
    body: dict,
    user: Annotated[dict, Depends(require_permission("ASSIGN_DOCK"))],
    db: Annotated[Session, Depends(get_db)],
):
    return ReceivingService(db).assign_dock(user, body["deliveryId"], body["dockId"])


@router.post("/receiving/start")
def start_receiving(
    body: dict,
    user: Annotated[dict, Depends(require_permission("START_RECEIVING"))],
    db: Annotated[Session, Depends(get_db)],
):
    return ReceivingService(db).start_receiving(user, body["deliveryId"])


@router.post("/grn/generate")
def generate_grn(
    body: dict,
    user: Annotated[dict, Depends(require_permission("GENERATE_GRN"))],
    db: Annotated[Session, Depends(get_db)],
):
    return ReceivingService(db).generate_grn(user, body["deliveryId"])


@router.get("/wallets/{vendor_id}")
def get_wallet(
    vendor_id: str,
    user: Annotated[dict, Depends(require_permission("VIEW_WALLET"))],
    db: Annotated[Session, Depends(get_db)],
):
    return WalletService(db).get_wallet(vendor_id)


@router.post("/wallets/recharge")
def recharge_wallet(
    body: dict,
    user: Annotated[dict, Depends(require_permission("CREATE_PAYMENT"))],
    db: Annotated[Session, Depends(get_db)],
):
    return WalletService(db).recharge(user, body["vendorId"], float(body["amount"]))
