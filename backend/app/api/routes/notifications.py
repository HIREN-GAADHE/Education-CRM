"""
Notification API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from uuid import UUID

from app.config.database import get_db
from app.core.permissions.decorators import require_permission
from app.core.middleware.auth import get_current_user
from app.models.user import User
from app.models.notification import (
    NotificationTemplate,
    Notification,
    NotificationType,
    NotificationStatus,
    NotificationPriority,
)
from app.schemas.notification import (
    NotificationTemplateCreate,
    NotificationTemplateUpdate,
    NotificationTemplateResponse,
    NotificationTemplateListResponse,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    SendNotificationRequest,
    BulkNotificationRequest,
    NotificationResponse,
    NotificationListResponse,
    NotificationStatsResponse,
    SendEmailRequest,
    SendSMSRequest,
    SendNotificationResponse,
)
from app.core.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ============== Template Endpoints ==============

@router.get("/templates", response_model=NotificationTemplateListResponse)
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    notification_type: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all notification templates for the tenant."""
    query = select(NotificationTemplate).where(
        NotificationTemplate.tenant_id == current_user.tenant_id
    )
    
    if notification_type:
        query = query.where(NotificationTemplate.notification_type == notification_type)
    
    if category:
        query = query.where(NotificationTemplate.category == category)
    
    # Count total
    from sqlalchemy import func
    count_query = select(func.count(NotificationTemplate.id)).where(
        NotificationTemplate.tenant_id == current_user.tenant_id
    )
    if notification_type:
        count_query = count_query.where(NotificationTemplate.notification_type == notification_type)
    if category:
        count_query = count_query.where(NotificationTemplate.category == category)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Paginate
    query = query.order_by(NotificationTemplate.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return NotificationTemplateListResponse(
        items=[NotificationTemplateResponse.model_validate(t) for t in templates],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/templates", response_model=NotificationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: NotificationTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new notification template."""
    # Check if template with same code exists
    existing = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.tenant_id == current_user.tenant_id,
            NotificationTemplate.code == template_data.code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template with code '{template_data.code}' already exists",
        )
    
    template = NotificationTemplate(
        tenant_id=current_user.tenant_id,
        **template_data.model_dump(),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return NotificationTemplateResponse.model_validate(template)


@router.get("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific notification template."""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id,
        )
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    return NotificationTemplateResponse.model_validate(template)


@router.put("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def update_template(
    template_id: UUID,
    template_data: NotificationTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a notification template."""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id,
        )
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System templates cannot be modified",
        )
    
    # Update fields
    for field, value in template_data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    
    return NotificationTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a notification template."""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id,
        )
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System templates cannot be deleted",
        )
    
    await db.delete(template)
    await db.commit()


@router.post("/templates/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: UUID,
    preview_data: TemplatePreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview a template with sample data."""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id,
        )
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Use provided data or template's sample data
    data = preview_data.data or template.sample_data or {}
    subject, body, html_body = template.render(data)
    
    return TemplatePreviewResponse(
        subject=subject,
        body=body,
        html_body=html_body,
    )


# ============== Notification Sending Endpoints ==============

@router.post("/send", response_model=SendNotificationResponse)
async def send_notification(
    request: SendNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a single notification."""
    service = NotificationService(db)
    
    try:
        notification = await service.send_notification(
            tenant_id=str(current_user.tenant_id),
            notification_type=NotificationType(request.notification_type.value),
            recipient_email=request.recipient.email,
            recipient_phone=request.recipient.phone,
            recipient_name=request.recipient.name,
            recipient_id=str(request.recipient.user_id) if request.recipient.user_id else None,
            subject=request.subject,
            body=request.body,
            html_body=request.html_body,
            template_code=request.template_code,
            template_data=request.data,
            priority=NotificationPriority(request.priority.value),
            metadata=request.metadata,
        )
        
        return SendNotificationResponse(
            success=notification.is_sent,
            notification_id=notification.id,
            message="Notification sent successfully" if notification.is_sent else f"Failed: {notification.error_message}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/send/bulk", response_model=dict)
async def send_bulk_notifications(
    request: BulkNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send bulk notifications to multiple recipients."""
    service = NotificationService(db)
    
    recipients = [
        {
            "email": r.email,
            "phone": r.phone,
            "name": r.name,
            "user_id": str(r.user_id) if r.user_id else None,
        }
        for r in request.recipients
    ]
    
    notifications = await service.send_bulk(
        tenant_id=str(current_user.tenant_id),
        notification_type=NotificationType(request.notification_type.value),
        recipients=recipients,
        template_code=request.template_code,
        template_data=request.data,
        subject=request.subject,
        body=request.body,
        priority=NotificationPriority(request.priority.value),
    )
    
    sent_count = sum(1 for n in notifications if n.is_sent)
    failed_count = len(notifications) - sent_count
    
    return {
        "total": len(notifications),
        "sent": sent_count,
        "failed": failed_count,
        "notification_ids": [str(n.id) for n in notifications],
    }


@router.post("/send/email", response_model=SendNotificationResponse)
async def send_quick_email(
    request: SendEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a quick email without using a template."""
    service = NotificationService(db)
    
    notification = await service.send_notification(
        tenant_id=str(current_user.tenant_id),
        notification_type=NotificationType.EMAIL,
        recipient_email=request.to,
        recipient_name=request.to_name,
        subject=request.subject,
        body=request.body,
        html_body=request.html_body,
        priority=NotificationPriority(request.priority.value),
    )
    
    return SendNotificationResponse(
        success=notification.is_sent,
        notification_id=notification.id,
        message="Email sent successfully" if notification.is_sent else f"Failed: {notification.error_message}",
    )


@router.post("/send/sms", response_model=SendNotificationResponse)
async def send_quick_sms(
    request: SendSMSRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a quick SMS without using a template."""
    service = NotificationService(db)
    
    notification = await service.send_notification(
        tenant_id=str(current_user.tenant_id),
        notification_type=NotificationType.SMS,
        recipient_phone=request.to,
        body=request.message,
        priority=NotificationPriority(request.priority.value),
    )
    
    return SendNotificationResponse(
        success=notification.is_sent,
        notification_id=notification.id,
        message="SMS sent successfully" if notification.is_sent else f"Failed: {notification.error_message}",
    )


# ============== Notification History Endpoints ==============

@router.get("/history", response_model=NotificationListResponse)
async def get_notification_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    notification_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notification history for the tenant."""
    service = NotificationService(db)
    
    n_type = NotificationType(notification_type) if notification_type else None
    n_status = NotificationStatus(status) if status else None
    
    notifications, total = await service.get_notifications(
        tenant_id=str(current_user.tenant_id),
        page=page,
        page_size=page_size,
        notification_type=n_type,
        status=n_status,
    )
    
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=NotificationStatsResponse)
async def get_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notification statistics for the tenant."""
    service = NotificationService(db)
    stats = await service.get_stats(str(current_user.tenant_id))
    return NotificationStatsResponse(**stats)


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific notification."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.tenant_id == current_user.tenant_id,
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    return NotificationResponse.model_validate(notification)
