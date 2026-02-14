from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime, date
from app.models.reminder import NotificationChannel, ReminderStatus, ReminderTriggerType

# --- Settings Schemas ---
class ReminderSettingsBase(BaseModel):
    auto_reminders_enabled: bool = True
    reminder_days_before: List[int] = [7, 3, 1]
    reminder_days_after: List[int] = [1, 7, 14, 30]
    
    monthly_reminder_enabled: bool = False
    monthly_reminder_day: int = 5
    monthly_reminder_template_id: Optional[UUID] = None

    email_enabled: bool = True
    sms_enabled: bool = False
    in_app_enabled: bool = True
    escalation_enabled: bool = False
    escalation_days: List[int] = [30]

class ReminderSettingsUpdate(ReminderSettingsBase):
    pass

class ReminderSettingsResponse(ReminderSettingsBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# --- Template Schemas ---
class ReminderTemplateBase(BaseModel):
    name: str
    type: NotificationChannel
    trigger_type: Optional[ReminderTriggerType] = None
    subject: Optional[str] = None
    body: str
    is_active: bool = True
    is_default: bool = False

class ReminderTemplateCreate(ReminderTemplateBase):
    pass

class ReminderTemplateUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[NotificationChannel] = None
    trigger_type: Optional[ReminderTriggerType] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

class ReminderTemplateResponse(ReminderTemplateBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# --- Log Schemas ---
class ReminderLogResponse(BaseModel):
    id: UUID
    student_id: Optional[UUID]
    fee_payment_id: Optional[UUID]
    channel: NotificationChannel
    recipient: str
    template_id: Optional[UUID]
    subject: Optional[str]
    message_content: Optional[str]
    status: ReminderStatus
    error_message: Optional[str]
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# --- Request Schemas ---
class ManualReminderRequest(BaseModel):
    student_ids: List[UUID]
    fee_payment_ids: Optional[List[UUID]] = None # If None, find all pending for students
    channels: List[NotificationChannel]
    template_id: Optional[UUID] = None
    custom_message: Optional[str] = None

class ReceiptRequest(BaseModel):
    payment_id: UUID
    channels: List[NotificationChannel] = [NotificationChannel.EMAIL]

class BulkReminderRequest(BaseModel):
    filters: Dict[str, Any]  # class_id, department, academic_year, status
    exclude_student_ids: Optional[List[UUID]] = None
    channels: List[NotificationChannel] = [NotificationChannel.EMAIL]
    template_id: Optional[UUID] = None
    custom_message: Optional[str] = None
