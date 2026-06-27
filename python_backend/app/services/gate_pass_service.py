import base64
import io
import json
from datetime import datetime, timedelta
from app.utils.timezone import ist_day_bounds, now_ist, parse_to_ist_naive, today_end_ist, today_start_ist

from fastapi import HTTPException
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session, joinedload

from app.config import get_fixed_otp, get_settings, is_test_mode_enabled
from app.models import Visit
from app.models.enums import VisitStatus
from app.services.gcp_storage_service import GcpStorageService
from app.services.messaging_service import WhatsAppService
from app.services.notifications_service import NotificationsService
from app.utils.test_mode import generate_otp


class GatePassService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.gcp = GcpStorageService()
        self.whatsapp = WhatsAppService()
        self.notifications = NotificationsService(db)

    def generate_check_in_otp(self, visit_id: str) -> dict:
        visit = self.db.get(Visit, visit_id)
        if not visit:
            raise HTTPException(status_code=404, detail="VISIT_NOT_FOUND")
        if visit.status in ("REJECTED", "CHECKED_OUT"):
            raise HTTPException(status_code=400, detail="VISIT_NOT_APPROVABLE")

        settings = get_settings()
        fixed = get_fixed_otp(settings)
        otp = fixed or ("654321" if is_test_mode_enabled(settings) else generate_otp(6))
        expires_at = now_ist() + timedelta(hours=8)
        visit.checkInOtp = otp
        visit.checkInOtpExpiry = expires_at
        visit.gatePassGeneratedAt = now_ist()
        self.db.commit()
        return {"checkInOtp": otp, "expiresAt": expires_at}

    def generate_gate_pass_image(self, visit_id: str) -> dict:
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.branch), joinedload(Visit.staff))
            .filter(Visit.id == visit_id)
            .first()
        )
        if not visit:
            raise HTTPException(status_code=404, detail="VISIT_NOT_FOUND")

        name = f"{visit.visitor.firstName} {visit.visitor.lastName}".strip()
        img = Image.new("RGB", (400, 600), color=(248, 249, 250))
        draw = ImageDraw.Draw(img)
        draw.text((20, 20), "VISITOR GATE PASS", fill=(44, 62, 80))
        draw.text((20, 60), f"Name: {name}", fill=(52, 73, 94))
        draw.text((20, 90), f"Phone: {visit.visitor.phone}", fill=(52, 73, 94))
        draw.text((20, 120), f"Branch: {visit.branch.name if visit.branch else 'N/A'}", fill=(52, 73, 94))
        draw.text((20, 150), f"Check-In OTP: {visit.checkInOtp or 'N/A'}", fill=(231, 76, 60))
        draw.text((20, 180), f"Category: {visit.visitCategory or 'N/A'}", fill=(52, 73, 94))

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
        return {"imageUrl": data_url}

    def upload_gate_pass_to_gcp(self, visit_id: str, gate_pass_base64: str) -> dict:
        if "," in gate_pass_base64:
            raw = base64.b64decode(gate_pass_base64.split(",", 1)[1])
        else:
            raw = base64.b64decode(gate_pass_base64)
        public_url, _ = self.gcp.upload_gate_pass_buffer(visit_id, raw)
        expiry = now_ist() + timedelta(days=7)
        visit = self.db.get(Visit, visit_id)
        if visit:
            visit.visitQRCode = public_url
            visit.gatePassUrlExpiry = expiry
            self.db.commit()
        return {"publicUrl": public_url, "urlExpiry": expiry}

    def send_gate_pass_via_whatsapp(self, visit_id: str, gate_pass_base64: str) -> dict:
        visit = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.branch))
            .filter(Visit.id == visit_id)
            .first()
        )
        if not visit or not visit.visitor or not visit.branch:
            return {"sent": False, "message": "Visit not found"}
        sent = self.whatsapp.send_gate_pass(
            visit.visitor.phone,
            visit.branch.name,
            gate_pass_base64,
        )
        if sent:
            visit.gatePassSentViaWhatsApp = True
            self.db.commit()
        return {"sent": sent, "message": "Sent" if sent else "Failed"}

    def verify_check_in_otp(
        self, otp: str, branch_id: str, user: dict, visit_id: str | None = None
    ) -> dict:
        if user.get("branchId") and branch_id != user.get("branchId"):
            raise HTTPException(status_code=403, detail="FORBIDDEN_BRANCH")

        base_query = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.staff))
            .filter(Visit.branchId == branch_id)
        )
        if visit_id:
            visit = base_query.filter(Visit.id == visit_id).first()
        else:
            visit = base_query.filter(
                (Visit.checkInOtp == otp) | (Visit.visitCode == otp)
            ).first()

        if not visit:
            raise HTTPException(status_code=404, detail="VISIT_NOT_FOUND")
        if visit.status == VisitStatus.CHECKED_IN.value:
            raise HTTPException(status_code=400, detail="ALREADY_CHECKED_IN")
        if visit.checkInOtp != otp and visit.visitCode != otp:
            raise HTTPException(status_code=400, detail="INVALID_OTP")
        if visit.checkInOtpExpiry and visit.checkInOtpExpiry < now_ist():
            raise HTTPException(status_code=400, detail="CHECKIN_OTP_EXPIRED")

        can_check_in = visit.status == VisitStatus.APPROVED.value
        if visit.visitor:
            self.notifications.notify_visitor_otp_verified(visit, visit.visitor, visit.staff)
        return {
            "success": True,
            "visitId": visit.id,
            "visitorId": visit.visitorId,
            "visitor": {
                "id": visit.visitor.id,
                "firstName": visit.visitor.firstName,
                "lastName": visit.visitor.lastName,
                "phone": visit.visitor.phone,
                "email": visit.visitor.email,
                "photo": visit.visitor.photo,
                "company": visit.visitor.company,
            },
            "visit": model_to_dict_visit(visit),
            "canCheckIn": can_check_in,
        }

    def _parse_qr_payload(self, qr_payload: str) -> tuple[str | None, str | None]:
        payload = qr_payload.strip()
        visit_id: str | None = None
        visit_code: str | None = None

        try:
            data = json.loads(payload)
            if isinstance(data, dict):
                visit_id = data.get("visitId")
                visit_code = data.get("visitCode")
        except json.JSONDecodeError:
            if len(payload) == 6 and payload.isdigit():
                visit_code = payload

        return visit_id, visit_code

    def scan_check_in_qr(self, qr_payload: str, user: dict) -> dict:
        visit_id, visit_code = self._parse_qr_payload(qr_payload)
        if not visit_id and not visit_code:
            raise HTTPException(status_code=400, detail="INVALID_QR_CODE")

        base_query = (
            self.db.query(Visit)
            .options(joinedload(Visit.visitor), joinedload(Visit.staff))
            .filter(Visit.branchId == user.get("branchId"))
        )
        if visit_id:
            visit = base_query.filter(Visit.id == visit_id).first()
        else:
            visit = base_query.filter(
                (Visit.visitCode == visit_code) | (Visit.checkInOtp == visit_code)
            ).first()

        if not visit:
            raise HTTPException(status_code=404, detail="VISIT_NOT_FOUND")

        if visit_code and visit.visitCode != visit_code and visit.checkInOtp != visit_code:
            raise HTTPException(status_code=400, detail="INVALID_QR_CODE")

        if visit.status == VisitStatus.CHECKED_IN.value:
            if visit.visitor:
                self.notifications.notify_visitor_otp_verified(visit, visit.visitor, visit.staff)
            return {
                "success": True,
                "visitId": visit.id,
                "visitorId": visit.visitorId,
                "visitor": {
                    "id": visit.visitor.id,
                    "firstName": visit.visitor.firstName,
                    "lastName": visit.visitor.lastName,
                    "phone": visit.visitor.phone,
                    "email": visit.visitor.email,
                    "photo": visit.visitor.photo,
                    "company": visit.visitor.company,
                },
                "visit": model_to_dict_visit(visit),
                "canCheckIn": False,
                "canCheckOut": True,
            }
        if visit.status != VisitStatus.APPROVED.value:
            raise HTTPException(status_code=400, detail="VISIT_NOT_APPROVED")
        if visit.checkInOtpExpiry and visit.checkInOtpExpiry < now_ist():
            raise HTTPException(status_code=400, detail="CHECKIN_OTP_EXPIRED")
        if not visit.isCodeUsed:
            raise HTTPException(status_code=400, detail="QR_CODE_ALREADY_USED")

        if visit.visitor:
            self.notifications.notify_visitor_otp_verified(visit, visit.visitor, visit.staff)

        return {
            "success": True,
            "visitId": visit.id,
            "visitorId": visit.visitorId,
            "visitor": {
                "id": visit.visitor.id,
                "firstName": visit.visitor.firstName,
                "lastName": visit.visitor.lastName,
                "phone": visit.visitor.phone,
                "email": visit.visitor.email,
                "photo": visit.visitor.photo,
                "company": visit.visitor.company,
            },
            "visit": model_to_dict_visit(visit),
            "canCheckIn": True,
            "canCheckOut": False,
        }


def model_to_dict_visit(visit: Visit) -> dict:
    return {
        "id": visit.id,
        "visitCategory": visit.visitCategory,
        "visitSubType": visit.visitSubType,
        "status": visit.status,
        "checkInOtp": visit.checkInOtp,
        "checkInOtpExpiry": visit.checkInOtpExpiry.isoformat() if visit.checkInOtpExpiry else None,
        "purpose": visit.purpose,
        "department": visit.department,
        "deliveryPlatform": visit.deliveryPlatform,
        "deliveryRecipient": visit.deliveryRecipient,
        "orderReference": visit.orderReference,
        "staffName": visit.staffName,
        "staffPhone": visit.staffPhone,
        "appointmentDate": visit.appointmentDate.isoformat() if visit.appointmentDate else None,
        "idProofVerified": visit.idProofVerified,
        "idProofType": visit.idProofType,
    }
