"""
Messages API Router - Internal messaging system
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
import math
import logging

from app.config.database import get_db
from app.models.message import Message
from app.models import Tenant
from app.core.permissions import require_permission
from app.core.services.message_service import MessageService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["Messages"])


# Pydantic Schemas
class MessageCreate(BaseModel):
    recipient_id: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_type: Optional[str] = "user"
    subject: str
    body: str
    priority: Optional[str] = "normal"
    is_important: Optional[bool] = False
    # New fields for class-wise filtering
    class_ids: Optional[List[str]] = None  # List of class UUIDs
    recipient_roles: Optional[List[str]] = None  # ['students', 'parents', 'teachers']


class BulkMessageCreate(BaseModel):
    """Schema for sending bulk messages to classes."""
    class_ids: List[str]  # Required: List of class UUIDs
    recipient_roles: List[str]  # Required: ['students', 'parents', 'teachers']
    subject: str
    body: str
    priority: Optional[str] = "normal"
    is_important: Optional[bool] = False


class RecipientCountRequest(BaseModel):
    """Schema for getting recipient count before sending."""
    class_ids: List[str]
    recipient_roles: List[str]


class RecipientCountResponse(BaseModel):
    """Response for recipient count."""
    students: int
    parents: int
    teachers: int
    total: int


class MessageUpdate(BaseModel):
    status: Optional[str] = None
    is_starred: Optional[bool] = None
    is_important: Optional[bool] = None


class MessageResponse(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    recipient_id: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_type: Optional[str] = None
    subject: str
    body: str
    priority: str
    status: str
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    is_starred: bool
    is_important: bool
    parent_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    items: List[MessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    unread_count: int


def message_to_response(message: Message) -> dict:
    """Convert Message model to response dict with proper UUID conversion."""
    return {
        "id": str(message.id),
        "tenant_id": str(message.tenant_id) if message.tenant_id else None,
        "sender_id": str(message.sender_id) if message.sender_id else None,
        "sender_name": message.sender_name,
        "sender_email": message.sender_email,
        "recipient_id": str(message.recipient_id) if message.recipient_id else None,
        "recipient_name": message.recipient_name,
        "recipient_email": message.recipient_email,
        "recipient_type": message.recipient_type,
        "subject": message.subject,
        "body": message.body,
        "priority": message.priority or "normal",
        "status": message.status or "sent",
        "sent_at": message.sent_at,
        "read_at": message.read_at,
        "is_starred": message.is_starred or False,
        "is_important": message.is_important or False,
        "parent_id": str(message.parent_id) if message.parent_id else None,
        "created_at": message.created_at,
        "updated_at": message.updated_at,
    }


# IMPORTANT: Put specific routes BEFORE parameterized routes to avoid conflicts

@router.get("/unread-count")
@require_permission("messages", "read")
async def get_unread_count(request: Request, db: AsyncSession = Depends(get_db)):
    """Get the count of unread messages."""
    try:
        result = await db.execute(
            select(func.count(Message.id)).where(
                Message.status != "read"
            )
        )
        count = result.scalar() or 0
        
        return {"unread_count": count}
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return {"unread_count": 0}


@router.post("/mark-all-read")
@require_permission("messages", "update")
async def mark_all_as_read(request: Request, db: AsyncSession = Depends(get_db)):
    """Mark all messages as read."""
    try:
        # Get all unread messages
        result = await db.execute(
            select(Message).where(
                Message.status != "read"
            )
        )
        messages = result.scalars().all()
        
        count = 0
        for message in messages:
            message.status = "read"
            message.read_at = datetime.utcnow()
            count += 1
        
        await db.commit()
        
        return {"success": True, "marked_count": count}
    except Exception as e:
        logger.error(f"Error marking all as read: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-all")
@require_permission("messages", "delete")
async def clear_all_notifications(request: Request, db: AsyncSession = Depends(get_db)):
    """Clear all notifications (delete all messages)."""
    try:
        # Get all messages and delete them
        result = await db.execute(select(Message))
        messages = result.scalars().all()
        
        count = 0
        for message in messages:
            await db.delete(message)
            count += 1
        
        await db.commit()
        
        return {"success": True, "cleared_count": count}
    except Exception as e:
        logger.error(f"Error clearing notifications: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recipient-count", response_model=RecipientCountResponse)
@require_permission("messages", "read")
async def get_recipient_count(
    request: Request,
    count_request: RecipientCountRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Get count of recipients based on class IDs and roles.
    Use this to preview how many people will receive the message before sending.
    """
    try:
        # Get tenant from request
        tenant_id = getattr(request.state, 'tenant_id', None)
        if not tenant_id:
            # Fallback to getting first tenant
            tenant_result = await db.execute(select(Tenant).limit(1))
            tenant = tenant_result.scalar_one_or_none()
            tenant_id = str(tenant.id) if tenant else None
        
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant not found")
        
        service = MessageService(db)
        counts = await service.get_recipient_count_by_class_and_roles(
            tenant_id=tenant_id,
            class_ids=count_request.class_ids,
            recipient_roles=count_request.recipient_roles
        )
        
        return RecipientCountResponse(**counts)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recipient count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk")
@require_permission("messages", "create")
async def send_bulk_messages(
    request: Request,
    bulk_data: BulkMessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Send messages to multiple recipients based on class and role filtering.
    
    Example:
    - Send to all students in Class 10-A and 10-B
    - Send to all parents of students in Class 5-A
    - Send to all teachers associated with Class 12-A
    """
    try:
        # Get tenant from request
        tenant_id = getattr(request.state, 'tenant_id', None)
        if not tenant_id:
            tenant_result = await db.execute(select(Tenant).limit(1))
            tenant = tenant_result.scalar_one_or_none()
            tenant_id = str(tenant.id) if tenant else None
        
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant not found")
        
        service = MessageService(db)
        
        # Get all recipients based on class and role filters
        recipients = await service.get_recipients_by_class_and_roles(
            tenant_id=tenant_id,
            class_ids=bulk_data.class_ids,
            recipient_roles=bulk_data.recipient_roles
        )
        
        if not recipients:
            raise HTTPException(
                status_code=400,
                detail="No recipients found for the selected classes and roles"
            )
        
        # Get sender info (if available from request)
        sender_name = getattr(request.state, 'user_name', 'Admin')
        sender_email = getattr(request.state, 'user_email', 'admin@school.edu')
        
        # Create messages for all recipients
        result = await service.create_bulk_messages(
            tenant_id=tenant_id,
            recipients=recipients,
            subject=bulk_data.subject,
            body=bulk_data.body,
            priority=bulk_data.priority or "normal",
            is_important=bulk_data.is_important or False,
            sender_name=sender_name,
            sender_email=sender_email,
            recipient_type="bulk"
        )
        
        return {
            "success": True,
            "message": f"Sent to {result['created']} recipients",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending bulk messages: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=MessageListResponse)
@require_permission("messages", "read")
async def list_messages(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    folder: Optional[str] = Query("inbox"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List messages with pagination and filtering."""
    try:
        query = select(Message)
        
        # Filter by folder
        if folder == "starred":
            query = query.where(Message.is_starred == True)
        elif folder == "important":
            query = query.where(Message.is_important == True)
        elif folder == "archived":
            query = query.where(Message.status == "archived")
        
        # Search filter
        if search:
            search_filter = or_(
                Message.subject.ilike(f"%{search}%"),
                Message.body.ilike(f"%{search}%"),
                Message.sender_name.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Get unread count
        unread_query = select(func.count(Message.id)).where(Message.status != "read")
        unread_result = await db.execute(unread_query)
        unread_count = unread_result.scalar() or 0
        
        # Apply pagination
        query = query.order_by(Message.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        messages = result.scalars().all()
        
        return MessageListResponse(
            items=[message_to_response(m) for m in messages],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
            unread_count=unread_count,
        )
    except Exception as e:
        logger.error(f"Error listing messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@require_permission("messages", "create")
async def send_message(
    request: Request,
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Send a new message."""
    try:
        # Get tenant
        tenant_result = await db.execute(select(Tenant).limit(1))
        tenant = tenant_result.scalar_one_or_none()
        
        # Create message
        message = Message(
            recipient_name=message_data.recipient_name,
            recipient_email=message_data.recipient_email,
            recipient_type=message_data.recipient_type or "user",
            subject=message_data.subject,
            body=message_data.body,
            priority=message_data.priority or "normal",
            is_important=message_data.is_important or False,
            status="sent",
            sent_at=datetime.utcnow(),
            sender_name="Admin",
            sender_email="admin@school.edu",
            is_starred=False,
        )
        
        if tenant:
            message.tenant_id = tenant.id
        
        db.add(message)
        await db.commit()
        await db.refresh(message)
        
        return message_to_response(message)
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Parameterized routes MUST come AFTER all specific routes

@router.get("/{message_id}", response_model=MessageResponse)
@require_permission("messages", "read")
async def get_message(
    request: Request,
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single message by ID and mark as read."""
    try:
        # Parse UUID
        try:
            msg_uuid = UUID(message_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid message ID format")
        
        result = await db.execute(
            select(Message).where(Message.id == msg_uuid)
        )
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Mark as read
        if message.status != "read":
            message.status = "read"
            message.read_at = datetime.utcnow()
            await db.commit()
            await db.refresh(message)
        
        return message_to_response(message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{message_id}", response_model=MessageResponse)
@require_permission("messages", "update")
async def update_message(
    request: Request,
    message_id: str,
    update_data: MessageUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update message status or flags."""
    try:
        try:
            msg_uuid = UUID(message_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid message ID format")
        
        result = await db.execute(
            select(Message).where(Message.id == msg_uuid)
        )
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Update fields
        if update_data.status is not None:
            message.status = update_data.status
            if update_data.status == "read" and not message.read_at:
                message.read_at = datetime.utcnow()
        if update_data.is_starred is not None:
            message.is_starred = update_data.is_starred
        if update_data.is_important is not None:
            message.is_important = update_data.is_important
        
        await db.commit()
        await db.refresh(message)
        
        return message_to_response(message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("messages", "delete")
async def delete_message(
    request: Request,
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a message."""
    try:
        try:
            msg_uuid = UUID(message_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid message ID format")
        
        result = await db.execute(
            select(Message).where(Message.id == msg_uuid)
        )
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        await db.delete(message)
        await db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{message_id}/reply", response_model=MessageResponse)
async def reply_to_message(
    message_id: str,
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Reply to a message."""
    try:
        try:
            msg_uuid = UUID(message_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid message ID format")
        
        # Get original message
        result = await db.execute(
            select(Message).where(Message.id == msg_uuid)
        )
        original = result.scalar_one_or_none()
        
        if not original:
            raise HTTPException(status_code=404, detail="Original message not found")
        
        # Create reply
        reply = Message(
            parent_id=original.id,
            recipient_name=original.sender_name,
            recipient_email=original.sender_email,
            subject=f"Re: {original.subject}",
            body=message_data.body,
            priority=message_data.priority or "normal",
            status="sent",
            sent_at=datetime.utcnow(),
            sender_name="Admin",
            sender_email="admin@school.edu",
            tenant_id=original.tenant_id,
            is_starred=False,
            is_important=False,
        )
        
        db.add(reply)
        await db.commit()
        await db.refresh(reply)
        
        return message_to_response(reply)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replying to message: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
