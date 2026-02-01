"""
Calendar Events API Router - CRUD operations for calendar events
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime, date
import math
import logging

from app.config.database import get_db
from app.models import CalendarEvent, EventType, EventStatus, Tenant
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calendar", tags=["Calendar"])


# Pydantic Schemas
class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = "other"
    start_datetime: datetime
    end_datetime: datetime
    all_day: Optional[bool] = False
    location: Optional[str] = None
    for_students: Optional[bool] = True
    for_staff: Optional[bool] = True
    color: Optional[str] = "#1976d2"
    status: Optional[str] = "scheduled"


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    for_students: Optional[bool] = None
    for_staff: Optional[bool] = None
    color: Optional[str] = None
    status: Optional[str] = None


class EventResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    event_type: str
    start_datetime: datetime
    end_datetime: datetime
    all_day: bool
    location: Optional[str] = None
    for_students: bool
    for_staff: bool
    color: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    items: List[EventResponse]
    total: int


@router.get("", response_model=EventListResponse)
@require_permission("calendar", "read")
async def list_events(
    request: Request,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    event_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List calendar events with optional date range filtering."""
    try:
        query = select(CalendarEvent).where(
            CalendarEvent.is_deleted == False,
            CalendarEvent.tenant_id == current_user.tenant_id  # Tenant isolation
        )
        
        if start_date:
            query = query.where(CalendarEvent.start_datetime >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.where(CalendarEvent.end_datetime <= datetime.combine(end_date, datetime.max.time()))
        
        if event_type:
            query = query.where(CalendarEvent.event_type == event_type)
        
        query = query.order_by(CalendarEvent.start_datetime.asc())
        
        result = await db.execute(query)
        events = result.scalars().all()
        
        return EventListResponse(items=events, total=len(events))
    except Exception as e:
        logger.error(f"Error listing events: {e}")
        raise HTTPException(status_code=500, detail="An error occurred")


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
@require_permission("calendar", "create")
async def create_event(
    request: Request,
    event_data: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new calendar event."""
    try:
        data = event_data.model_dump()
        # Remove timezone info for naive storage
        if data.get('start_datetime'):
            data['start_datetime'] = data['start_datetime'].replace(tzinfo=None)
        if data.get('end_datetime'):
            data['end_datetime'] = data['end_datetime'].replace(tzinfo=None)
            
        event = CalendarEvent(**data)
        event.tenant_id = current_user.tenant_id
        
        db.add(event)
        await db.commit()
        await db.refresh(event)
        
        return event
    except Exception as e:
        logger.error(f"Error creating event: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred")


@router.get("/{event_id}", response_model=EventResponse)
@require_permission("calendar", "read")
async def get_event(
    request: Request,
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single event by ID."""
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.tenant_id == current_user.tenant_id,
            CalendarEvent.is_deleted == False
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=EventResponse)
@require_permission("calendar", "update")
async def update_event(
    request: Request,
    event_id: UUID,
    event_data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.tenant_id == current_user.tenant_id,
            CalendarEvent.is_deleted == False
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = event_data.model_dump(exclude_unset=True)
    if update_data.get('start_datetime'):
        update_data['start_datetime'] = update_data['start_datetime'].replace(tzinfo=None)
    if update_data.get('end_datetime'):
        update_data['end_datetime'] = update_data['end_datetime'].replace(tzinfo=None)
        
    for field, value in update_data.items():
        setattr(event, field, value)
    
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("calendar", "delete")
async def delete_event(
    request: Request,
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.tenant_id == current_user.tenant_id,
            CalendarEvent.is_deleted == False
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.is_deleted = True
    event.deleted_at = datetime.utcnow()
    event.deleted_by = current_user.id
    await db.commit()
    return None
