"""
Reminder Service - Handles fee reminders and notifications
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from uuid import UUID

from app.models.reminder import (
    ReminderSettings, ReminderTemplate, ReminderLog, 
    NotificationChannel, ReminderStatus, ReminderTriggerType
)
from app.models.fee import FeePayment, PaymentStatus
from app.models.student import Student
from app.models.parent_student import ParentStudent, RelationshipType
from app.models.user import User
from app.models.notification import NotificationType, NotificationPriority
from app.core.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

class ReminderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_service = NotificationService(db)

    async def get_settings(self, tenant_id: UUID) -> ReminderSettings:
        """Get or create reminder settings for a tenant"""
        result = await self.db.execute(
            select(ReminderSettings).where(ReminderSettings.tenant_id == tenant_id)
        )
        settings = result.scalar_one_or_none()
        
        if not settings:
            settings = ReminderSettings(tenant_id=tenant_id)
            self.db.add(settings)
            await self.db.commit()
            await self.db.refresh(settings)
            
        return settings

    async def update_settings(self, tenant_id: UUID, settings_data: Dict[str, Any]) -> ReminderSettings:
        """Update reminder settings"""
        settings = await self.get_settings(tenant_id)
        
        for key, value in settings_data.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
                
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def get_templates(self, tenant_id: UUID) -> List[ReminderTemplate]:
        """Get all reminder templates"""
        result = await self.db.execute(
            select(ReminderTemplate).where(
                ReminderTemplate.tenant_id == tenant_id,
                ReminderTemplate.deleted_at.is_(None)
            )
        )
        return result.scalars().all()

    async def send_manual_reminder(
        self,
        tenant_id: UUID,
        fee_payment_id: UUID,
        channels: List[NotificationChannel],
        student_id: Optional[UUID] = None,
        template_id: Optional[UUID] = None,
        custom_message: Optional[str] = None
    ) -> List[ReminderLog]:
        """Send a manual reminder for a specific fee payment"""
        
        # 1. Fetch details
        payment_result = await self.db.execute(
            select(FeePayment).where(FeePayment.id == fee_payment_id)
        )
        payment = payment_result.scalar_one_or_none()
        
        if not payment:
            raise ValueError("FeePayment not found")
            
        # Use student_id from payment if not provided
        target_student_id = student_id or payment.student_id
        
        student_result = await self.db.execute(
            select(Student).where(Student.id == target_student_id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise ValueError("Student not found")

        # 2. Get recipients (Student + Parents)
        recipients = []
        
        # Add student if they have contact info
        if student.email:
            recipients.append({"type": "student", "email": student.email, "name": student.full_name, "phone": student.phone})
            
        # Add parents
        parent_links_result = await self.db.execute(
            select(ParentStudent).where(ParentStudent.student_id == student_id)
        )
        parent_links = parent_links_result.scalars().all()
        
        # Also check direct fields on student (legacy support)
        if student.parent_email:
             recipients.append({
                 "type": "parent", 
                 "email": student.parent_email, 
                 "name": student.father_name or student.mother_name or "Parent",
                 "phone": student.father_phone or student.mother_phone
             })

        logs = []
        
        # 3. Prepare message
        body = custom_message
        subject = "Fee Payment Reminder"
        
        if template_id:
            template_result = await self.db.execute(
                select(ReminderTemplate).where(ReminderTemplate.id == template_id)
            )
            template = template_result.scalar_one_or_none()
            if template:
                body = template.body
                subject = template.subject or subject
                # TODO: Replace placeholders
        
        if not body:
            body = f"Dear Parent/Student, This is a reminder to pay the fee of amount {payment.amount} for {student.full_name}. Due date: {payment.due_date}."

        # 4. Send notifications via requested channels
        for channel in channels:
            for recipient in recipients:
                notification_type = None
                recipient_contact = None
                
                if channel == NotificationChannel.EMAIL:
                    notification_type = NotificationType.EMAIL
                    recipient_contact = recipient.get("email")
                elif channel == NotificationChannel.SMS:
                    notification_type = NotificationType.SMS
                    recipient_contact = recipient.get("phone")
                
                if not notification_type or not recipient_contact:
                    continue
                    
                # Create log entry first (pending)
                log = ReminderLog(
                    tenant_id=tenant_id,
                    student_id=student_id,
                    fee_payment_id=fee_payment_id,
                    channel=channel,
                    recipient=recipient_contact,
                    template_id=template_id,
                    subject=subject,
                    message_content=body,
                    status=ReminderStatus.PENDING,
                    sent_at=datetime.utcnow()
                )
                self.db.add(log)
                await self.db.commit() # Get ID
                
                try:
                    # Send using NotificationService
                    notification = await self.notification_service.send_notification(
                        tenant_id=tenant_id,
                        notification_type=notification_type,
                        recipient_email=recipient_contact if channel == NotificationChannel.EMAIL else None,
                        recipient_phone=recipient_contact if channel == NotificationChannel.SMS else None,
                        recipient_name=recipient.get("name"),
                        subject=subject,
                        body=body,
                        metadata={
                            "fee_payment_id": str(fee_payment_id),
                            "reminder_log_id": str(log.id),
                            "source": "manual_reminder"
                        }
                    )
                    
                    # Update log
                    if notification.status in [NotificationStatus.SENT, NotificationStatus.DELIVERED]:
                        log.status = ReminderStatus.SENT
                    else:
                        log.status = ReminderStatus.FAILED
                        log.error_message = notification.error_message
                        
                except Exception as e:
                    log.status = ReminderStatus.FAILED
                    log.error_message = str(e)
                
                await self.db.commit()
                logs.append(log)
                
        return logs

    async def process_auto_reminders(self, tenant_id: Optional[UUID] = None):
        """
        Check for fees due and send auto-reminders.
        """
        # 1. Get tenants to process
        query = select(ReminderSettings).where(ReminderSettings.auto_reminders_enabled == True)
        if tenant_id:
            query = query.where(ReminderSettings.tenant_id == tenant_id)
            
        settings_result = await self.db.execute(query)
        all_settings = settings_result.scalars().all()
        
        today = date.today()
        
        for settings in all_settings:
            # Check upcoming due dates (days BEFORE)
            if settings.reminder_days_before:
                for days in settings.reminder_days_before:
                    target_date = today + timedelta(days=days)
                    await self._send_due_date_reminders(
                        settings.tenant_id, 
                        target_date, 
                        ReminderTriggerType.BEFORE_DUE,
                        days
                    )
            
            # Check overdue dates (days AFTER)
            if settings.reminder_days_after:
                for days in settings.reminder_days_after:
                    target_date = today - timedelta(days=days)
                    await self._send_due_date_reminders(
                        settings.tenant_id, 
                        target_date, 
                        ReminderTriggerType.AFTER_DUE,
                        days
                    )

    async def _send_due_date_reminders(
        self, 
        tenant_id: UUID, 
        target_date: date, 
        trigger_type: ReminderTriggerType,
        days_diff: int
    ):
        """Helper to find and send reminders for a specific date"""
        # Find payments due on target_date
        # Status must be PENDING or OVERDUE (assuming PARTIAL is also pending)
        query = select(FeePayment).where(
            FeePayment.tenant_id == tenant_id,
            FeePayment.due_date == target_date,
            FeePayment.status.in_([PaymentStatus.PENDING, PaymentStatus.OVERDUE, PaymentStatus.PARTIAL])
        )
        
        result = await self.db.execute(query)
        payments = result.scalars().all()
        
        for payment in payments:
            # TODO: Check if reminder already sent for this trigger?
            # For now, we assume if script runs once a day, it processes correctly based on date match
            
            # Message
            if trigger_type == ReminderTriggerType.BEFORE_DUE:
                message = f"Reminder: Fee of {payment.amount} is due in {days_diff} days on {payment.due_date}."
            else:
                message = f"Urgent: Fee of {payment.amount} was due {days_diff} days ago on {payment.due_date}. Please pay immediately."
            
            # Send (reuse manual logic or similar)
            # We default to EMAIL if enabled, SMS if enabled
            settings = await self.get_settings(tenant_id)
            channels = []
            if settings.email_enabled: channels.append(NotificationChannel.EMAIL)
            if settings.sms_enabled: channels.append(NotificationChannel.SMS)
            
            if channels:
                await self.send_manual_reminder(
                    tenant_id=tenant_id,
                    student_id=payment.student_id,
                    fee_payment_id=payment.id,
                    channels=channels,
                    custom_message=message
                )

    async def send_receipt(
        self,
        tenant_id: UUID,
        payment_id: UUID,
        channels: List[NotificationChannel]
    ):
        """Send fee receipt to student/parent"""
        payment_result = await self.db.execute(
            select(FeePayment).where(FeePayment.id == payment_id)
        )
        payment = payment_result.scalar_one_or_none()
        
        if not payment or payment.status not in [PaymentStatus.PAID, PaymentStatus.PARTIAL]:
            raise ValueError("Payment not found or not paid")
            
        student_result = await self.db.execute(
            select(Student).where(Student.id == payment.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        # Link to download receipt (placeholder for now)
        receipt_link = f"/api/v1/fees/{payment.id}/receipt" 
        
        message = f"Payment Successful. Receipt for {student.full_name}, Amount: {payment.amount_paid}. Download: {receipt_link}"
        
        # Send
        # Reusing send_manual_reminder logic but simplified or separate?
        # Let's call NotificationService directly to avoid creating "ReminderLog" for receipts?
        # Or maybe receipts ARE reminders/notifications suitable for log? Let's log them.
        
        # Actually better to use existing manual reminder flow but with Receipt specific template or message
        # But Receipt is ON_PAYMENT trigger.
        
        # For simplicity, reuse logic but customized
        # ... logic similar to send_manual_reminder ...
        # I'll call send_manual_reminder with the custom receipt message for now.
        return await self.send_manual_reminder(
            tenant_id=tenant_id,
            student_id=payment.student_id,
            fee_payment_id=payment.id,
            channels=channels,
            custom_message=message
        )

    async def process_monthly_reminders(self, tenant_id: Optional[UUID] = None):
        """
        Check if today is the scheduled monthly reminder day and send reminders.
        """
        # 1. Get tenants with monthly reminders enabled
        query = select(ReminderSettings).where(ReminderSettings.monthly_reminder_enabled == True)
        if tenant_id:
            query = query.where(ReminderSettings.tenant_id == tenant_id)
            
        settings_result = await self.db.execute(query)
        all_settings = settings_result.scalars().all()
        
        today_day = date.today().day
        
        for settings in all_settings:
            if settings.monthly_reminder_day == today_day:
                logger.info(f"Processing monthly reminders for tenant {settings.tenant_id}")
                await self.send_bulk_reminders_by_filter(
                    tenant_id=settings.tenant_id,
                    filters={"status": "pending"}, # Default to pending/overdue logic inside
                    channels=[NotificationChannel.EMAIL] if settings.email_enabled else [], # simplistic logic
                    template_id=settings.monthly_reminder_template_id
                )

    async def send_bulk_reminders_by_filter(
        self,
        tenant_id: UUID,
        filters: Dict[str, Any],
        channels: List[NotificationChannel],
        exclude_student_ids: Optional[List[UUID]] = None,
        template_id: Optional[UUID] = None,
        custom_message: Optional[str] = None
    ) -> int:
        """
        Send reminders to all students matching filters.
        Returns count of reminders sent (queued).
        """
        # Filters: class_id, department, academic_year, status
        # We need to find FeePayments matching these.
        
        query = select(FeePayment).join(Student).where(FeePayment.tenant_id == tenant_id)
        
        # Apply Filters
        if filters.get("class_id"):
            query = query.where(Student.class_id == filters["class_id"])
            
        if filters.get("department"):
             query = query.where(Student.department == filters["department"])
             
        if filters.get("academic_year"):
            query = query.where(FeePayment.academic_year == filters["academic_year"])
            
        # Status filter
        status = filters.get("status")
        if status:
             query = query.where(FeePayment.status == status)
        else:
             # Default: Pending, Partial, Overdue
             query = query.where(FeePayment.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE]))
             
        if exclude_student_ids:
            query = query.where(Student.id.notin_(exclude_student_ids))

        # Fetch payments
        result = await self.db.execute(query)
        payments = result.scalars().all()
        
        count = 0
        for payment in payments:
            # Send (reuse manual logic)
            # Warning: This is synchronous loop calling async. Be careful with large datasets.
            # In production, this should probably queue individual tasks or batch them.
            # For now, we await sequentially.
            try:
                await self.send_manual_reminder(
                    tenant_id=tenant_id,
                    student_id=payment.student_id,
                    fee_payment_id=payment.id,
                    channels=channels,
                    template_id=template_id,
                    custom_message=custom_message
                )
                count += 1
            except Exception as e:
                logger.error(f"Failed to send bulk reminder for payment {payment.id}: {e}")
                
        return count
