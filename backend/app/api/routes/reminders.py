from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.config import get_db
from app.api.deps import  get_current_user
from app.models.user import User
from app.core.services.reminder_service import ReminderService
from app.schemas.reminder import (
    ReminderSettingsResponse, ReminderSettingsUpdate,
    ReminderTemplateResponse, ReminderTemplateCreate, ReminderTemplateUpdate,
    ReminderLogResponse,
    ManualReminderRequest,
    ReceiptRequest,
    BulkReminderRequest
)
from app.models.reminder import NotificationChannel, ReminderTemplate

router = APIRouter(prefix="/reminders", tags=["Reminders"])

@router.get("/settings", response_model=ReminderSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get fee reminder settings for the current tenant"""
    service = ReminderService(db)
    return await service.get_settings(current_user.tenant_id)

@router.put("/settings", response_model=ReminderSettingsResponse)
async def update_settings(
    settings_data: ReminderSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update fee reminder settings"""
    service = ReminderService(db)
    return await service.update_settings(current_user.tenant_id, settings_data.dict(exclude_unset=True))

@router.get("/templates", response_model=List[ReminderTemplateResponse])
async def get_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all reminder templates"""
    service = ReminderService(db)
    return await service.get_templates(current_user.tenant_id)

@router.post("/templates", response_model=ReminderTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: ReminderTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new reminder template"""
    from sqlalchemy import select
    template = ReminderTemplate(
        tenant_id=current_user.tenant_id,
        name=template_data.name,
        type=template_data.type,
        trigger_type=template_data.trigger_type,
        subject=template_data.subject,
        body=template_data.body,
        is_active=template_data.is_active,
        is_default=template_data.is_default,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template

@router.put("/templates/{template_id}", response_model=ReminderTemplateResponse)
async def update_template(
    template_id: UUID,
    template_data: ReminderTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a reminder template"""
    from sqlalchemy import select
    result = await db.execute(
        select(ReminderTemplate).where(
            ReminderTemplate.id == template_id,
            ReminderTemplate.tenant_id == current_user.tenant_id,
            ReminderTemplate.deleted_at.is_(None)
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    return template

@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft-delete a reminder template"""
    from sqlalchemy import select
    from datetime import datetime
    result = await db.execute(
        select(ReminderTemplate).where(
            ReminderTemplate.id == template_id,
            ReminderTemplate.tenant_id == current_user.tenant_id,
            ReminderTemplate.deleted_at.is_(None)
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.deleted_at = datetime.utcnow()
    await db.commit()
    return None

@router.post("/send", response_model=List[ReminderLogResponse])
async def send_reminders(
    request: ManualReminderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send manual fee reminders to selected students"""
    from app.models.fee import FeePayment, PaymentStatus
    from app.models.student import Student
    from sqlalchemy import select
    
    service = ReminderService(db)
    all_logs = []
    
    if request.fee_payment_ids:
        # Send for specific payment IDs — derive student from each payment
        for payment_id in request.fee_payment_ids:
            try:
                logs = await service.send_manual_reminder(
                    tenant_id=current_user.tenant_id,
                    fee_payment_id=payment_id,
                    channels=request.channels,
                    template_id=request.template_id,
                    custom_message=request.custom_message
                )
                all_logs.extend(logs)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send reminder for payment {payment_id}: {e}")
                continue
            
    elif request.student_ids:
        # Find all pending/overdue payments for these students and remind
        for sid in request.student_ids:
            result = await db.execute(
                select(FeePayment).where(
                    FeePayment.student_id == sid,
                    FeePayment.tenant_id == current_user.tenant_id,
                    FeePayment.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE])
                )
            )
            payments = result.scalars().all()
            for payment in payments:
                try:
                    logs = await service.send_manual_reminder(
                        tenant_id=current_user.tenant_id,
                        fee_payment_id=payment.id,
                        student_id=sid,
                        channels=request.channels,
                        template_id=request.template_id,
                        custom_message=request.custom_message
                    )
                    all_logs.extend(logs)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to send reminder for student {sid}: {e}")
                    continue

    return all_logs

@router.post("/receipt", response_model=List[ReminderLogResponse])
async def send_receipt(
    request: ReceiptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send fee receipt"""
    service = ReminderService(db)
    return await service.send_receipt(
        tenant_id=current_user.tenant_id,
        payment_id=request.payment_id,
        channels=request.channels
    )

@router.post("/bulk-send")
async def bulk_send_reminders(
    request: BulkReminderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send bulk reminders based on filters.
    Triggered via Celery task in production, but for now direct async call.
    """
    service = ReminderService(db)
    
    # In a real production scenario, we would push this to Celery:
    # process_bulk_reminders_task.delay(current_user.tenant_id, request.dict())
    # But for immediate feedback in this MVP phase:
    
    count = await service.send_bulk_reminders_by_filter(
        tenant_id=current_user.tenant_id,
        filters=request.filters,
        channels=request.channels,
        exclude_student_ids=request.exclude_student_ids,
        template_id=request.template_id,
        custom_message=request.custom_message
    )
    
    return {"message": f"Bulk reminders processing initiated. Sent/Queued: {count}"}
