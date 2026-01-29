"""
Notification models for email, SMS, and other notification channels.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import BaseModel, TenantBaseModel, TimestampMixin


class NotificationType(str, enum.Enum):
    """Notification type enumeration."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WHATSAPP = "whatsapp"
    IN_APP = "in_app"


class NotificationStatus(str, enum.Enum):
    """Notification status enumeration."""
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"


class NotificationPriority(str, enum.Enum):
    """Notification priority enumeration."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationTemplate(TenantBaseModel, TimestampMixin):
    """
    Notification template for reusable message formats.
    Templates support variable substitution using {{variable_name}} syntax.
    """
    __tablename__ = "notification_templates"
    
    # Identification
    code = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Template content
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    subject = Column(String(500), nullable=True)  # For email
    body = Column(Text, nullable=False)
    html_body = Column(Text, nullable=True)  # For email HTML version
    
    # Variables schema (for validation)
    variables = Column(JSONB, default=[])  # List of required variable names
    sample_data = Column(JSONB, default={})  # Sample data for preview
    
    # Settings
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # System templates can't be deleted
    
    # Category for organization
    category = Column(String(100), nullable=True)  # e.g., "fees", "attendance", "academic"
    
    # Relationships
    notifications = relationship("Notification", back_populates="template", lazy="dynamic")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='uq_notification_template_tenant_code'),
    )
    
    def __repr__(self):
        return f"<NotificationTemplate {self.code}>"
    
    def render(self, data: dict) -> tuple[str, str, str | None]:
        """
        Render template with provided data.
        Returns (subject, body, html_body)
        """
        subject = self.subject or ""
        body = self.body
        html_body = self.html_body
        
        for key, value in data.items():
            placeholder = f"{{{{{key}}}}}"
            subject = subject.replace(placeholder, str(value))
            body = body.replace(placeholder, str(value))
            if html_body:
                html_body = html_body.replace(placeholder, str(value))
        
        return subject, body, html_body


class Notification(TenantBaseModel, TimestampMixin):
    """
    Individual notification record.
    Tracks each notification sent to a recipient.
    """
    __tablename__ = "notifications"
    
    # Template reference (optional - can send without template)
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates.id"), nullable=True)
    
    # Notification details
    notification_type = Column(SQLEnum(NotificationType), nullable=False, index=True)
    priority = Column(SQLEnum(NotificationPriority), default=NotificationPriority.NORMAL)
    
    # Recipient
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recipient_email = Column(String(255), nullable=True)
    recipient_phone = Column(String(20), nullable=True)
    recipient_name = Column(String(255), nullable=True)
    
    # Content
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    html_body = Column(Text, nullable=True)
    
    # Data used for template rendering
    template_data = Column(JSONB, default={})
    
    # Status tracking
    status = Column(SQLEnum(NotificationStatus), default=NotificationStatus.PENDING, index=True)
    
    # Timestamps
    queued_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    
    # Provider response
    provider = Column(String(50), nullable=True)  # e.g., "smtp", "msg91", "twilio"
    provider_message_id = Column(String(255), nullable=True)
    provider_response = Column(JSONB, default={})
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True)
    
    # Extra data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    template = relationship("NotificationTemplate", back_populates="notifications")
    recipient = relationship("User", foreign_keys=[recipient_id])
    
    def __repr__(self):
        return f"<Notification {self.id} - {self.notification_type.value}>"
    
    @property
    def is_sent(self) -> bool:
        """Check if notification was successfully sent."""
        return self.status in [NotificationStatus.SENT, NotificationStatus.DELIVERED]
    
    @property
    def can_retry(self) -> bool:
        """Check if notification can be retried."""
        return (
            self.status == NotificationStatus.FAILED and
            self.retry_count < self.max_retries
        )
    
    def mark_sent(self, provider: str, message_id: str = None):
        """Mark notification as sent."""
        self.status = NotificationStatus.SENT
        self.sent_at = datetime.utcnow()
        self.provider = provider
        if message_id:
            self.provider_message_id = message_id
    
    def mark_failed(self, error: str):
        """Mark notification as failed."""
        self.status = NotificationStatus.FAILED
        self.failed_at = datetime.utcnow()
        self.error_message = error
        self.retry_count += 1


class NotificationPreference(TenantBaseModel):
    """
    User notification preferences.
    Controls which notifications a user wants to receive.
    """
    __tablename__ = "notification_preferences"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Channel preferences
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=True)
    push_enabled = Column(Boolean, default=True)
    whatsapp_enabled = Column(Boolean, default=False)
    in_app_enabled = Column(Boolean, default=True)
    
    # Category preferences (which categories to receive)
    enabled_categories = Column(ARRAY(String), default=[])  # Empty = all categories
    disabled_categories = Column(ARRAY(String), default=[])
    
    # Quiet hours
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(String(5), nullable=True)  # HH:MM format
    quiet_hours_end = Column(String(5), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'user_id', name='uq_notification_preference_tenant_user'),
    )
    
    def __repr__(self):
        return f"<NotificationPreference user={self.user_id}>"
