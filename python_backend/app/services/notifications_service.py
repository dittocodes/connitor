from app.utils.timezone import format_ist_datetime, now_ist

import logging
import random

from sqlalchemy.orm import Session

from app.config import get_settings, is_meta_whatsapp_configured, is_pywhatkit_configured
from app.models import Branch, Department, Notification, SubDepartment, User, Visit, Visitor
from app.models.enums import AppointmentMode, Role
from app.services.calendar_service import AppointmentCalendarDetails, CalendarService
from app.services.messaging_service import EmailService, SmsService, WhatsAppService

logger = logging.getLogger(__name__)


class NotificationsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.email = EmailService()
        self.sms = SmsService()
        self.whatsapp = WhatsAppService()
        self.calendar = CalendarService()

    def _branch_address(self, branch: Branch) -> str:
        return ", ".join(
            part
            for part in (
                branch.street,
                branch.city,
                branch.state,
                branch.pinCode,
                branch.country,
            )
            if part
        )

    def _calendar_details(
        self,
        visit: Visit,
        doctor: User,
        visitor: Visitor,
        *,
        branch: Branch | None = None,
        department: Department | None = None,
        sub_department: SubDepartment | None = None,
        status: str,
        sequence: int = 0,
    ) -> AppointmentCalendarDetails | None:
        if not visitor.email or not visit.appointmentDate:
            return None

        if branch is None:
            branch = self.db.get(Branch, visit.branchId)
        if department is None and visit.departmentId:
            department = self.db.get(Department, visit.departmentId)
        if sub_department is None and visit.subDepartmentId:
            sub_department = self.db.get(SubDepartment, visit.subDepartmentId)

        if not branch:
            return None

        return AppointmentCalendarDetails(
            visit_id=visit.id,
            visitor_email=visitor.email,
            visitor_name=self._visitor_name(visitor),
            doctor_name=doctor.name,
            hospital_name=branch.name,
            hospital_address=self._branch_address(branch),
            department_name=department.name if department else None,
            sub_department_name=sub_department.name if sub_department else None,
            appointment_date=visit.appointmentDate,
            purpose=visit.purpose,
            status=status,  # type: ignore[arg-type]
            sequence=sequence,
            appointment_mode=visit.appointmentMode or AppointmentMode.IN_PERSON.value,
            zoom_join_url=visit.zoomJoinUrl if self._is_online(visit) else None,
        )

    def _send_calendar_invite(
        self,
        visit: Visit,
        doctor: User,
        visitor: Visitor,
        *,
        branch: Branch | None = None,
        department: Department | None = None,
        sub_department: SubDepartment | None = None,
        status: str,
        sequence: int = 0,
    ) -> None:
        details = self._calendar_details(
            visit,
            doctor,
            visitor,
            branch=branch,
            department=department,
            sub_department=sub_department,
            status=status,
            sequence=sequence,
        )
        if not details:
            return
        try:
            self.calendar.send_appointment_calendar_invite(details, email_service=self.email)
        except Exception as exc:
            logger.error("Calendar invite failed for visit %s: %s", visit.id, exc)

    def _visitor_name(self, visitor: Visitor) -> str:
        middle = f" {visitor.middleName}" if visitor.middleName else ""
        return f"{visitor.firstName}{middle} {visitor.lastName}".strip()

    def _add_notification(self, recipient_id: str, visit_id: str, message: str) -> None:
        self.db.add(Notification(recipientId=recipient_id, visitId=visit_id, message=message))

    def _email_user(self, user: User, subject: str, message: str) -> None:
        if user.email:
            try:
                self.email.send_notification(user.email, subject, message)
            except Exception as exc:
                logger.error("Failed to email user %s: %s", user.email, exc)

    def _email_users(self, users: list[User], subject: str, message: str) -> None:
        seen: set[str] = set()
        for user in users:
            if user.email and user.email not in seen:
                seen.add(user.email)
                self._email_user(user, subject, message)

    def _format_appt(self, visit: Visit) -> str:
        if not visit.appointmentDate:
            return "scheduled time"
        return format_ist_datetime(visit.appointmentDate)

    def _sms_user(self, user: User, message: str) -> None:
        if user.phone:
            try:
                self.sms.send_message(user.phone, message)
            except Exception as exc:
                logger.error("Failed to SMS user %s: %s", user.phone, exc)

    def _sms_users(self, users: list[User], message: str) -> None:
        seen: set[str] = set()
        for user in users:
            if user.phone and user.phone not in seen:
                seen.add(user.phone)
                self._sms_user(user, message)

    def _email_visitor(self, visitor: Visitor, subject: str, message: str) -> None:
        if visitor.email:
            try:
                self.email.send_notification(visitor.email, subject, message)
            except Exception as exc:
                logger.error("Failed to email visitor %s: %s", visitor.email, exc)

    def _is_online(self, visit: Visit) -> bool:
        return visit.appointmentMode == AppointmentMode.ONLINE.value

    def notify_visitor_booking_received(
        self,
        visit: Visit,
        doctor: User,
        visitor: Visitor,
        *,
        branch: Branch | None = None,
        department: Department | None = None,
        sub_department: SubDepartment | None = None,
    ) -> None:
        appt = self._format_appt(visit)
        name = self._visitor_name(visitor)
        if branch is None:
            branch = self.db.get(Branch, visit.branchId)
        hospital_name = branch.name if branch else "the hospital"
        dept_name = department.name if department else None
        if not dept_name and visit.departmentId:
            dept = self.db.get(Department, visit.departmentId)
            dept_name = dept.name if dept else None

        self._send_calendar_invite(
            visit,
            doctor,
            visitor,
            branch=branch,
            department=department,
            sub_department=sub_department,
            status="tentative",
            sequence=0,
        )

        if visitor.email:
            try:
                self.email.send_booking_confirmation_email(
                    visitor.email,
                    visitor_name=name,
                    doctor_name=doctor.name,
                    appointment_date=appt,
                    hospital_name=hospital_name,
                    booking_id=visit.id,
                    department_name=dept_name,
                    purpose=visit.purpose,
                    appointment_mode=visit.appointmentMode or AppointmentMode.IN_PERSON.value,
                )
            except Exception as exc:
                logger.error("Failed to send booking confirmation email to %s: %s", visitor.email, exc)

        if self._is_online(visit):
            sms_text = (
                f"Connitor: Online appointment request sent to Dr. {doctor.name} for {appt}. "
                "Awaiting doctor approval. Zoom link will be sent once approved."
            )
        else:
            sms_text = (
                f"Connitor: Appointment request sent to Dr. {doctor.name} for {appt}. "
                "Awaiting doctor approval. You will receive a QR code once approved."
            )
        self.sms.send_message(visitor.phone, sms_text)

    def _ensure_sms_approval_code(self, visit: Visit) -> str:
        if visit.smsApprovalCode:
            return visit.smsApprovalCode
        code = f"{random.randint(100000, 999999)}"
        visit.smsApprovalCode = code
        return code

    def notify_staff_on_visit_request(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        from app.services.messaging_service import build_doctor_approval_whatsapp_message
        from app.services.visit_approval_link_service import VisitApprovalLinkService

        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        purpose = (visit.purpose or "").strip() or "Not specified"
        approval_code = self._ensure_sms_approval_code(visit)
        _, approval_url = VisitApprovalLinkService(self.db).create_link(visit)
        dashboard_message = (
            f"New appointment from {name} on {appt}. Purpose: {purpose}. "
            "Check WhatsApp or email for the one-time approval link."
        )
        email_message = (
            f"You have a new appointment request from {name} for {appt}. "
            f"Purpose: {purpose}. "
            f"Approve in one tap (no login required): {approval_url}"
        )
        self._add_notification(staff.id, visit.id, dashboard_message)
        self._email_user(staff, "New Appointment Request", email_message)
        if staff.phone:
            whatsapp_body = build_doctor_approval_whatsapp_message(
                visitor_name=name,
                appointment_label=appt,
                purpose=purpose,
                approval_url=approval_url,
                approval_code=approval_code,
            )
            if is_meta_whatsapp_configured(get_settings()):
                details_sent = False
                try:
                    self.whatsapp.send_doctor_approval_details(staff.phone, whatsapp_body)
                    details_sent = True
                except Exception as exc:
                    logger.warning("Meta doctor approval details message failed: %s", exc)
                try:
                    self.whatsapp.send_appointment_approval_buttons(
                        staff.phone,
                        visitor_name=name,
                        appointment_label=appt,
                        approval_code=approval_code,
                        purpose=purpose,
                        approval_url=approval_url,
                    )
                except Exception as exc:
                    logger.error(
                        "Failed to send WhatsApp approval buttons to %s: %s",
                        staff.phone,
                        exc,
                    )
                    if not details_sent:
                        self._sms_user(staff, whatsapp_body)
                if not details_sent and is_pywhatkit_configured(get_settings()):
                    try:
                        self.sms._deliver_whatsapp(staff.phone, whatsapp_body)
                    except Exception as exc:
                        logger.warning("PyWhatKit approval link message failed: %s", exc)
            else:
                delivered = False
                try:
                    delivered = self.sms._deliver_whatsapp(staff.phone, whatsapp_body)
                except Exception as exc:
                    logger.warning("WhatsApp approval link delivery failed: %s", exc)
                if not delivered:
                    self._sms_user(staff, whatsapp_body)
        self.db.commit()

    def notify_security_on_new_visit_request(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        mode_hint = " (online — no physical check-in)" if self._is_online(visit) else ""
        message = (
            f"New appointment from {name} with Dr. {staff.name} on {appt}{mode_hint}. "
            "Pending doctor approval."
        )
        security_users = self._security_users(visit.branchId)
        for security in security_users:
            self._add_notification(security.id, visit.id, message)
        self._email_users(security_users, "New Appointment — Pending Approval", message)
        self._sms_users(
            security_users,
            f"Connitor: New visitor {name} with Dr. {staff.name} on {appt}. Pending doctor approval.",
        )
        self.db.commit()

    def notify_admins_on_doctor_approval(self, visit: Visit, doctor: User, visitor: Visitor) -> None:
        name = self._visitor_name(visitor)
        online_hint = " Online appointment — no physical check-in required." if self._is_online(visit) else ""
        msg = f"Appointment approved: {name} with Dr. {doctor.name} on {self._format_appt(visit)}.{online_hint}"
        email_subject = "Appointment Approved by Doctor"
        recipients: list[User] = []

        super_admins = (
            self.db.query(User)
            .filter(User.role == Role.SUPER_ADMIN.value, User.isActive == True)  # noqa: E712
            .all()
        )
        for admin in super_admins:
            self._add_notification(admin.id, visit.id, msg)
            recipients.append(admin)

        for admin in self._hospital_admins_for_branch(visit.branchId):
            self._add_notification(admin.id, visit.id, msg)
            recipients.append(admin)

        if visit.departmentId:
            dept_admins = (
                self.db.query(User)
                .filter(
                    User.role == Role.DEPARTMENT_ADMIN.value,
                    User.departmentId == visit.departmentId,
                    User.isActive == True,  # noqa: E712
                )
                .all()
            )
            for admin in dept_admins:
                self._add_notification(admin.id, visit.id, msg)
                recipients.append(admin)

        if visit.subDepartmentId:
            sub_admins = (
                self.db.query(User)
                .filter(
                    User.role == Role.SUB_DEPARTMENT_ADMIN.value,
                    User.subDepartmentId == visit.subDepartmentId,
                    User.isActive == True,  # noqa: E712
                )
                .all()
            )
            for admin in sub_admins:
                self._add_notification(admin.id, visit.id, msg)
                recipients.append(admin)

        security_users = self._security_users(visit.branchId)
        security_msg = (
            f"Approved appointment: {name} with Dr. {doctor.name}. "
            + ("Online visit — monitor only, no check-in." if self._is_online(visit) else "Prepare for check-in.")
        )
        for security in security_users:
            self._add_notification(security.id, visit.id, security_msg)
            recipients.append(security)

        self._email_users(recipients, email_subject, security_msg)
        admin_users = [u for u in recipients if u not in security_users]
        self._sms_users(
            admin_users,
            f"Connitor: Appointment approved: {name} with Dr. {doctor.name}."
            + (
                " Online visit — no physical check-in required."
                if self._is_online(visit)
                else ""
            ),
        )
        self._sms_users(
            security_users,
            f"Connitor: Approved visitor {name} with Dr. {doctor.name}. "
            + (
                "Online visit today — no physical check-in."
                if self._is_online(visit)
                else "Prepare for check-in today."
            ),
        )
        self.db.commit()

    def notify_staff_on_approval(self, visit: Visit, doctor: User, visitor: Visitor) -> None:
        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        message = f"You approved the appointment for {name} on {appt}. The visitor has been notified."
        self._add_notification(doctor.id, visit.id, message)
        self._email_user(doctor, "Appointment Approved", message)
        self._sms_user(
            doctor,
            f"Connitor: You approved {name}'s appointment on {appt}. Visitor notified with check-in QR.",
        )
        self.db.commit()

    def notify_visitor_approval(self, visit: Visit, visitor: Visitor, doctor: User) -> None:
        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        check_in_otp = visit.checkInOtp or visit.visitCode
        feedback = (visit.doctorFeedback or "").strip()

        self._send_calendar_invite(
            visit,
            doctor,
            visitor,
            status="confirmed",
            sequence=1,
        )

        if visitor.email and check_in_otp:
            try:
                self.email.send_gate_pass_email(
                    visitor.email,
                    visitor_name=name,
                    doctor_name=doctor.name,
                    appointment_date=appt,
                    check_in_otp=check_in_otp,
                    qr_image_base64=visit.visitQRCode,
                    doctor_feedback=feedback or None,
                )
            except Exception as exc:
                logger.error("Failed to send gate pass email to %s: %s", visitor.email, exc)
        elif visitor.email:
            msg = f"Your appointment with Dr. {doctor.name} on {appt} has been approved."
            if feedback:
                msg += f"\n\nMessage from your doctor:\n{feedback}"
            self.email.send_notification(visitor.email, "Appointment Approved", msg)

        if check_in_otp:
            self.sms.send_message(
                visitor.phone,
                f"Connitor: Appointment approved with Dr. {doctor.name}. Check-in OTP: {check_in_otp}. "
                "Show QR from your email at security.",
            )
        else:
            self.sms.send_message(
                visitor.phone,
                f"Your appointment with Dr. {doctor.name} on {appt} has been approved.",
            )

    def notify_visitor_online_approval(self, visit: Visit, visitor: Visitor, doctor: User) -> None:
        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        feedback = (visit.doctorFeedback or "").strip()
        join_url = visit.zoomJoinUrl or ""

        self._send_calendar_invite(visit, doctor, visitor, status="confirmed", sequence=1)

        if visitor.email and join_url:
            try:
                self.email.send_online_appointment_email(
                    visitor.email,
                    recipient_name=name,
                    doctor_name=doctor.name,
                    appointment_date=appt,
                    zoom_url=join_url,
                    doctor_feedback=feedback or None,
                    is_host=False,
                    meeting_password=visit.zoomPassword,
                )
            except Exception as exc:
                logger.error("Failed to send online appointment email to %s: %s", visitor.email, exc)

        if join_url:
            pwd = f" Password: {visit.zoomPassword}." if visit.zoomPassword else ""
            self.sms.send_message(
                visitor.phone,
                f"Connitor: Online appointment approved with Dr. {doctor.name}. Join: {join_url}.{pwd}",
            )

    def notify_doctor_online_approval(self, visit: Visit, doctor: User, visitor: Visitor) -> None:
        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        start_url = visit.zoomStartUrl or visit.zoomJoinUrl or ""
        message = (
            f"You approved the online appointment for {name} on {appt}. "
            "Zoom meeting created and sent to the visitor."
        )
        self._add_notification(doctor.id, visit.id, message)
        if doctor.email and start_url:
            try:
                self.email.send_online_appointment_email(
                    doctor.email,
                    recipient_name=doctor.name or "Doctor",
                    doctor_name=doctor.name,
                    appointment_date=appt,
                    zoom_url=start_url,
                    doctor_feedback=None,
                    is_host=True,
                    meeting_password=visit.zoomPassword,
                )
            except Exception as exc:
                logger.error("Failed to send online host email to %s: %s", doctor.email, exc)
        else:
            self._email_user(doctor, "Online Appointment Approved", message)
        if start_url and doctor.phone:
            self._sms_user(
                doctor,
                f"Connitor: Online appointment with {name} on {appt}. Start Zoom: {start_url}",
            )
        self.db.commit()

    def notify_online_meeting_started(self, visit: Visit, visitor: Visitor, doctor: User) -> None:
        name = self._visitor_name(visitor)
        appt = self._format_appt(visit)
        started = visit.checkInTime.strftime("%d %b %Y %H:%M") if visit.checkInTime else "now"
        visitor_msg = (
            f"Hello {name},\n\n"
            f"Your online consultation with Dr. {doctor.name} ({appt}) has started.\n\n"
            f"Started at: {started}\n\n"
            "Use the Zoom join link from your approval email if you are not already in the meeting."
        )
        doctor_msg = (
            f"Your online consultation with {name} ({appt}) has started.\n\n"
            f"Started at: {started}"
        )
        self._email_visitor(visitor, "Online Consultation Started", visitor_msg)
        self._add_notification(doctor.id, visit.id, doctor_msg)
        self._email_user(doctor, "Online Consultation Started", doctor_msg)
        if visitor.phone:
            self.sms.send_message(
                visitor.phone,
                f"Connitor: Online consultation with Dr. {doctor.name} has started.",
            )
        if doctor.phone:
            self._sms_user(doctor, f"Connitor: Online consultation with {name} has started.")
        self.db.commit()

    def notify_online_meeting_completed(
        self, visit: Visit, visitor: Visitor, doctor: User | None, duration: int | None
    ) -> None:
        name = self._visitor_name(visitor)
        doctor_name = doctor.name if doctor else visit.staffName or "your doctor"
        dur = f"{duration} minutes" if duration is not None else "your consultation"
        ended = visit.checkOutTime.strftime("%d %b %Y %H:%M") if visit.checkOutTime else "now"
        visitor_msg = (
            f"Hello {name},\n\n"
            f"Your online consultation with Dr. {doctor_name} is complete.\n\n"
            f"Ended at: {ended}\n"
            f"Duration: {dur}.\n\n"
            "Thank you for using our online consultation service."
        )
        admin_msg = f"Online consultation completed: {name} with Dr. {doctor_name} ({dur})."
        self._email_visitor(visitor, "Online Consultation Completed", visitor_msg)
        if visitor.phone:
            self.sms.send_message(
                visitor.phone,
                f"Connitor: Online consultation with Dr. {doctor_name} completed. Duration: {dur}.",
            )
        if doctor:
            self._add_notification(doctor.id, visit.id, admin_msg)
            self._email_user(doctor, "Online Consultation Completed", admin_msg)
            if doctor.phone:
                self._sms_user(
                    doctor,
                    f"Connitor: Online consultation with {name} completed ({dur}).",
                )
        self._notify_all_admins(visit, admin_msg, email_subject="Online Consultation Completed")
        self.db.commit()

    def notify_visitor_rejection(
        self, visit: Visit, visitor: Visitor, doctor: User, rejection_reason: str
    ) -> None:
        name = self._visitor_name(visitor)
        appt = visit.appointmentDate.strftime("%d %b %Y %H:%M") if visit.appointmentDate else "your scheduled time"
        msg = (
            f"Hello {name},\n\n"
            f"Your appointment request with Dr. {doctor.name} on {appt} was not approved.\n\n"
            f"Reason: {rejection_reason}\n\n"
            "You may book another appointment from the hospital portal."
        )
        self._email_visitor(visitor, "Appointment Not Approved", msg)
        self._send_calendar_invite(
            visit,
            doctor,
            visitor,
            status="cancelled",
            sequence=2,
        )
        self.sms.send_message(
            visitor.phone,
            f"Appointment with Dr. {doctor.name} was not approved. Reason: {rejection_reason}",
        )

    def notify_visitor_id_verified(self, visit: Visit, visitor: Visitor, doctor: User | None) -> None:
        name = self._visitor_name(visitor)
        doctor_name = doctor.name if doctor else visit.staffName or "your doctor"
        appt = visit.appointmentDate.strftime("%d %b %Y %H:%M") if visit.appointmentDate else "your appointment"
        msg = (
            f"Hello {name},\n\n"
            f"Your ID has been verified by hospital security for your visit with Dr. {doctor_name} "
            f"on {appt}.\n\n"
            "Please proceed to complete check-in at the security desk."
        )
        self._email_visitor(visitor, "ID Verified — Proceed to Check-in", msg)

    def notify_visitor_otp_verified(self, visit: Visit, visitor: Visitor, doctor: User | None) -> None:
        name = self._visitor_name(visitor)
        doctor_name = doctor.name if doctor else visit.staffName or "your doctor"
        appt = visit.appointmentDate.strftime("%d %b %Y %H:%M") if visit.appointmentDate else "your appointment"
        msg = (
            f"Hello {name},\n\n"
            f"Your check-in OTP was verified successfully for your appointment with Dr. {doctor_name} "
            f"on {appt}.\n\n"
            "Security will complete your check-in shortly."
        )
        self._email_visitor(visitor, "Check-in OTP Verified", msg)

    def notify_visitor_checked_in(self, visit: Visit, visitor: Visitor, doctor: User | None) -> None:
        name = self._visitor_name(visitor)
        doctor_name = doctor.name if doctor else visit.staffName or "your doctor"
        appt = visit.appointmentDate.strftime("%d %b %Y %H:%M") if visit.appointmentDate else "today"
        check_in_time = (
            visit.checkInTime.strftime("%d %b %Y %H:%M") if visit.checkInTime else "just now"
        )
        msg = (
            f"Hello {name},\n\n"
            f"You have checked in at the hospital for your appointment with Dr. {doctor_name} "
            f"({appt}).\n\n"
            f"Check-in time: {check_in_time}\n\n"
            "Please wait in the reception area. Your doctor has been notified of your arrival."
        )
        self._email_visitor(visitor, "Checked In Successfully", msg)

    def notify_visitor_checked_out(
        self, visit: Visit, visitor: Visitor, doctor: User | None, duration: int | None
    ) -> None:
        name = self._visitor_name(visitor)
        doctor_name = doctor.name if doctor else visit.staffName or "your doctor"
        dur = f"{duration} minutes" if duration is not None else "your visit"
        msg = (
            f"Hello {name},\n\n"
            f"Thank you for visiting. You have checked out after meeting Dr. {doctor_name}.\n\n"
            f"Visit duration: {dur}.\n\n"
            "We hope you had a good experience. Safe travels!"
        )
        self._email_visitor(visitor, "Checked Out — Thank You for Visiting", msg)

    def notify_security_on_visit_approval(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        message = (
            f"Visit for {self._visitor_name(visitor)} to meet {staff.name} "
            "has been approved. Please prepare for check-in."
        )
        security_users = self._security_users(visit.branchId)
        for security in security_users:
            self._add_notification(security.id, visit.id, message)
        self._email_users(security_users, "Visit Approved — Prepare for Check-in", message)
        self.db.commit()

    def notify_staff_on_check_in(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        name = self._visitor_name(visitor)
        message = f"Your patient, {name}, has checked in and is on their way."
        self._add_notification(staff.id, visit.id, message)
        self._email_user(staff, "Patient Checked In", message)
        self.db.commit()

    def notify_doctor_patient_arrived(self, visit: Visit, doctor: User, visitor: Visitor) -> None:
        name = self._visitor_name(visitor)
        appt = visit.appointmentDate.strftime("%d %b %Y %H:%M") if visit.appointmentDate else "today"
        check_in_time = (
            visit.checkInTime.strftime("%d %b %Y %H:%M") if visit.checkInTime else "just now"
        )
        msg = (
            f"Your patient {name} has arrived for their appointment ({appt}) and checked in at "
            f"{check_in_time}.\n\n"
            "Please be ready to receive them."
        )
        self._add_notification(doctor.id, visit.id, msg)
        self._email_user(doctor, "Patient Arrived for Appointment", msg)
        if doctor.phone:
            self.sms.send_message(doctor.phone, f"Patient {name} has checked in for their appointment.")
        visit.doctorNotifiedAt = now_ist()
        self.db.commit()

    def notify_admins_on_check_in(self, visit: Visit, visitor: Visitor, doctor: User | None) -> None:
        name = self._visitor_name(visitor)
        doctor_name = doctor.name if doctor else visit.staffName or "staff"
        msg = f"Check-in: {name} arrived for appointment with {doctor_name}."
        self._notify_all_admins(visit, msg, email_subject="Visitor Checked In")

    def notify_admins_on_check_out(
        self, visit: Visit, visitor: Visitor, doctor: User | None, duration: int | None
    ) -> None:
        name = self._visitor_name(visitor)
        dur = f"{duration} minutes" if duration is not None else "unknown duration"
        msg = f"Check-out: {name} left after {dur}."
        self._notify_all_admins(visit, msg, email_subject="Visitor Checked Out")

    def _notify_all_admins(
        self, visit: Visit, message: str, *, email_subject: str = "Hospital Notification"
    ) -> None:
        recipients: list[User] = []
        super_admins = (
            self.db.query(User)
            .filter(User.role == Role.SUPER_ADMIN.value, User.isActive == True)  # noqa: E712
            .all()
        )
        for admin in super_admins:
            self._add_notification(admin.id, visit.id, message)
            recipients.append(admin)
        for admin in self._hospital_admins_for_branch(visit.branchId):
            self._add_notification(admin.id, visit.id, message)
            recipients.append(admin)
        if visit.departmentId:
            for admin in (
                self.db.query(User)
                .filter(
                    User.role == Role.DEPARTMENT_ADMIN.value,
                    User.departmentId == visit.departmentId,
                    User.isActive == True,  # noqa: E712
                )
                .all()
            ):
                self._add_notification(admin.id, visit.id, message)
                recipients.append(admin)
        if visit.subDepartmentId:
            for admin in (
                self.db.query(User)
                .filter(
                    User.role == Role.SUB_DEPARTMENT_ADMIN.value,
                    User.subDepartmentId == visit.subDepartmentId,
                    User.isActive == True,  # noqa: E712
                )
                .all()
            ):
                self._add_notification(admin.id, visit.id, message)
                recipients.append(admin)
        self._email_users(recipients, email_subject, message)
        self.db.commit()

    def notify_staff_on_security_approval(self, visit: Visit, staff: User, visitor: Visitor) -> None:
        message = f"Security has approved the visit for {self._visitor_name(visitor)}."
        self._add_notification(staff.id, visit.id, message)
        self._email_user(staff, "Visit Approved by Security", message)
        self.db.commit()

    def notify_staff_on_security_rejection(
        self, visit: Visit, staff: User, visitor: Visitor, rejection_reason: str
    ) -> None:
        message = (
            f"Security has rejected the visit for {self._visitor_name(visitor)}. "
            f"Reason: {rejection_reason}"
        )
        self._add_notification(staff.id, visit.id, message)
        self._email_user(staff, "Visit Rejected by Security", message)
        self.db.commit()

    def _hospital_admins_for_branch(self, branch_id: str) -> list[User]:
        return (
            self.db.query(User)
            .filter(
                User.branchId == branch_id,
                User.role == Role.HOSPITAL_ADMIN.value,
                User.isActive == True,  # noqa: E712
            )
            .all()
        )

    def _security_users(self, branch_id: str) -> list[User]:
        return (
            self.db.query(User)
            .filter(
                User.branchId == branch_id,
                User.role.in_([Role.SECURITY.value, Role.SECURITY_SUPERVISOR.value]),
                User.isActive == True,  # noqa: E712
            )
            .all()
        )

    def get_unread_notifications(self, user_id: str) -> list[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.recipientId == user_id, Notification.read == False)  # noqa: E712
            .order_by(Notification.createdAt.desc())
            .all()
        )

    def mark_as_read(self, notification_id: str, user_id: str) -> Notification:
        from fastapi import HTTPException

        notification = (
            self.db.query(Notification)
            .filter(Notification.id == notification_id, Notification.recipientId == user_id)
            .first()
        )
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found or access denied.")
        notification.read = True
        self.db.commit()
        self.db.refresh(notification)
        return notification
