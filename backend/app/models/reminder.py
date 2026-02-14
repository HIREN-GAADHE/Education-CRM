"""
Reminder Models - For fee reminders and notifications
"""
from sqlalchemy import Column, String, Boolean, JSON, TIMESTAMP, ForeignKey, Text, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin

class ReminderTriggerType(str, enum.Enum):
    BEFORE_DUE = "before_due"
    AFTER_DUE = "after_due"
    MANUAL = "manual"
    SPECIFIC_DATE = "specific_date"
    ON_PAYMENT = "on_payment"

class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    IN_APP = "in_app"

class ReminderStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"

class ReminderSettings(TenantBaseModel):
    """
    Tenant-level settings for fee reminders
    """
    __tablename__ = "reminder_settings"
    
    auto_reminders_enabled = Column(Boolean, default=True)
    
    # Days relative to due date: e.g. [7, 3, 1] means 7, 3, 1 days before due date
    reminder_days_before = Column(JSONB, default=[7, 3, 1])
    
    # Days relative to due date: e.g. [1, 7, 14, 30] means 1, 7, 14, 30 days after due date
    reminder_days_after = Column(JSONB, default=[1, 7, 14, 30])
    
    # Monthly Fixed Date Reminder
    monthly_reminder_enabled = Column(Boolean, default=False)
    monthly_reminder_day = Column(Integer, default=5) # 1-31
    monthly_reminder_template_id = Column(UUID(as_uuid=True), ForeignKey("reminder_templates.id"), nullable=True)

    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    in_app_enabled = Column(Boolean, default=True)
    
    escalation_enabled = Column(Boolean, default=False)
    # If escalation enabled, notify guardian after X days overdue
    escalation_days = Column(JSONB, default=[30])

    def __repr__(self):
        return f"<ReminderSettings for Tenant {self.tenant_id}>"

class ReminderTemplate(TenantBaseModel, SoftDeleteMixin):
    """
    Customizable message templates for reminders
    """
    __tablename__ = "reminder_templates"
    
    name = Column(String(100), nullable=False)
    type = Column(Enum(NotificationChannel), nullable=False) # email, sms
    trigger_type = Column(Enum(ReminderTriggerType), nullable=True) # before_due, after_due, etc.
    
    subject = Column(String(200), nullable=True) # For email
    body = Column(Text, nullable=False) # Supports placeholders like {student_name}
    
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)

    def __repr__(self):
        return f"<ReminderTemplate {self.name}>"

class ReminderLog(TenantBaseModel):
    """
    Log of all sent reminders
    """
    __tablename__ = "reminder_logs"
    
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True, index=True)
    student = relationship("Student", backref="reminders")
    
    fee_payment_id = Column(UUID(as_uuid=True), ForeignKey("fee_payments.id"), nullable=True, index=True)
    fee_payment = relationship("FeePayment", backref="reminders")
    
    channel = Column(Enum(NotificationChannel), nullable=False)
    recipient = Column(String(255), nullable=False) # Email or Phone number
    
    template_id = Column(UUID(as_uuid=True), ForeignKey("reminder_templates.id"), nullable=True)
    template = relationship("ReminderTemplate")
    
    subject = Column(String(200), nullable=True)
    message_content = Column(Text, nullable=True)
    
    status = Column(Enum(ReminderStatus), default=ReminderStatus.PENDING)
    delivery_response = Column(JSONB, nullable=True) # Response from gateway
    error_message = Column(Text, nullable=True)
    
    sent_at = Column(TIMESTAMP, nullable=True)
    read_at = Column(TIMESTAMP, nullable=True)

    def __repr__(self):
        return f"<ReminderLog {self.id} Status: {self.status}>"
