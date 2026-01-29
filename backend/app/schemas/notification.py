"""
Notification schemas for API requests and responses.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import UUID


class NotificationTypeEnum(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WHATSAPP = "whatsapp"
    IN_APP = "in_app"


class NotificationStatusEnum(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"


class NotificationPriorityEnum(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# ============== Template Schemas ==============

class NotificationTemplateBase(BaseModel):
    """Base schema for notification template."""
    code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    notification_type: NotificationTypeEnum
    subject: Optional[str] = Field(None, max_length=500)
    body: str
    html_body: Optional[str] = None
    variables: List[str] = []
    sample_data: Dict[str, Any] = {}
    category: Optional[str] = None
    is_active: bool = True


class NotificationTemplateCreate(NotificationTemplateBase):
    """Schema for creating a notification template."""
    pass


class NotificationTemplateUpdate(BaseModel):
    """Schema for updating a notification template."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=500)
    body: Optional[str] = None
    html_body: Optional[str] = None
    variables: Optional[List[str]] = None
    sample_data: Optional[Dict[str, Any]] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class NotificationTemplateResponse(NotificationTemplateBase):
    """Schema for notification template response."""
    id: UUID
    tenant_id: UUID
    is_system: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NotificationTemplateListResponse(BaseModel):
    """Schema for list of notification templates."""
    items: List[NotificationTemplateResponse]
    total: int
    page: int
    page_size: int


class TemplatePreviewRequest(BaseModel):
    """Schema for previewing a template with sample data."""
    data: Dict[str, Any] = {}


class TemplatePreviewResponse(BaseModel):
    """Schema for template preview response."""
    subject: Optional[str] = None
    body: str
    html_body: Optional[str] = None


# ============== Notification Schemas ==============

class NotificationRecipient(BaseModel):
    """Schema for notification recipient."""
    user_id: Optional[UUID] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{6,14}$')
    name: Optional[str] = None


class SendNotificationRequest(BaseModel):
    """Schema for sending a notification."""
    notification_type: NotificationTypeEnum
    template_code: Optional[str] = None
    recipient: NotificationRecipient
    subject: Optional[str] = None
    body: Optional[str] = None
    html_body: Optional[str] = None
    data: Dict[str, Any] = {}
    priority: NotificationPriorityEnum = NotificationPriorityEnum.NORMAL
    metadata: Dict[str, Any] = {}


class BulkNotificationRequest(BaseModel):
    """Schema for sending bulk notifications."""
    notification_type: NotificationTypeEnum
    template_code: Optional[str] = None
    recipients: List[NotificationRecipient]
    subject: Optional[str] = None
    body: Optional[str] = None
    data: Dict[str, Any] = {}
    priority: NotificationPriorityEnum = NotificationPriorityEnum.NORMAL


class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: UUID
    tenant_id: UUID
    notification_type: NotificationTypeEnum
    priority: NotificationPriorityEnum
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_name: Optional[str] = None
    subject: Optional[str] = None
    body: str
    status: NotificationStatusEnum
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Schema for list of notifications."""
    items: List[NotificationResponse]
    total: int
    page: int
    page_size: int


class NotificationStatsResponse(BaseModel):
    """Schema for notification statistics."""
    total_sent: int
    total_delivered: int
    total_failed: int
    total_pending: int
    by_type: Dict[str, int]
    by_status: Dict[str, int]


# ============== Preference Schemas ==============

class NotificationPreferenceUpdate(BaseModel):
    """Schema for updating notification preferences."""
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    enabled_categories: Optional[List[str]] = None
    disabled_categories: Optional[List[str]] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = Field(None, pattern=r'^([01]\d|2[0-3]):([0-5]\d)$')
    quiet_hours_end: Optional[str] = Field(None, pattern=r'^([01]\d|2[0-3]):([0-5]\d)$')


class NotificationPreferenceResponse(BaseModel):
    """Schema for notification preferences response."""
    id: UUID
    user_id: UUID
    email_enabled: bool
    sms_enabled: bool
    push_enabled: bool
    whatsapp_enabled: bool
    in_app_enabled: bool
    enabled_categories: List[str]
    disabled_categories: List[str]
    quiet_hours_enabled: bool
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============== Quick Send Schemas ==============

class SendEmailRequest(BaseModel):
    """Schema for sending a quick email."""
    to: EmailStr
    to_name: Optional[str] = None
    subject: str
    body: str
    html_body: Optional[str] = None
    priority: NotificationPriorityEnum = NotificationPriorityEnum.NORMAL


class SendSMSRequest(BaseModel):
    """Schema for sending a quick SMS."""
    to: str = Field(..., pattern=r'^\+?[1-9]\d{6,14}$')
    message: str = Field(..., max_length=1600)
    priority: NotificationPriorityEnum = NotificationPriorityEnum.NORMAL


class SendNotificationResponse(BaseModel):
    """Schema for send notification response."""
    success: bool
    notification_id: Optional[UUID] = None
    message: str
