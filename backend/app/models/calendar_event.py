"""
Calendar Event Model - Events and scheduling for the Education ERP
"""
from sqlalchemy import Column, String, DateTime, Text, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from datetime import datetime
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin


class EventType(str, enum.Enum):
    HOLIDAY = "holiday"
    EXAM = "exam"
    MEETING = "meeting"
    SEMINAR = "seminar"
    SPORTS = "sports"
    CULTURAL = "cultural"
    WORKSHOP = "workshop"
    ASSIGNMENT = "assignment"
    OTHER = "other"


class EventStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class CalendarEvent(TenantBaseModel, SoftDeleteMixin):
    """
    Calendar Event - represents events, holidays, exams, meetings, etc.
    """
    __tablename__ = "calendar_events"
    
    # Event Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(Enum(EventType), default=EventType.OTHER)
    
    # Timing
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    all_day = Column(Boolean, default=False)
    
    # Location
    location = Column(String(255), nullable=True)
    
    # Recurrence (for recurring events)
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(255), nullable=True)  # iCal RRULE format
    
    # Target audience
    for_students = Column(Boolean, default=True)
    for_staff = Column(Boolean, default=True)
    for_parents = Column(Boolean, default=False)
    
    # Specific targeting (optional)
    departments = Column(ARRAY(String), nullable=True)
    courses = Column(ARRAY(String), nullable=True)
    
    # Status
    status = Column(Enum(EventStatus), default=EventStatus.SCHEDULED)
    
    # Color for calendar display
    color = Column(String(20), default="#1976d2")
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    def __repr__(self):
        return f"<CalendarEvent {self.title}>"
