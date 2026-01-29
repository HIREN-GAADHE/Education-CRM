"""
Timetable models for class scheduling.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Time, Integer, ForeignKey, Enum as SQLEnum, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, time
import enum

from app.models.base import TenantBaseModel, TimestampMixin


class DayOfWeek(int, enum.Enum):
    """Day of week enumeration (ISO 8601: Monday=1, Sunday=7)."""
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6
    SUNDAY = 7


class TimeSlotType(str, enum.Enum):
    """Time slot type enumeration."""
    CLASS = "class"
    BREAK = "break"
    LUNCH = "lunch"
    ASSEMBLY = "assembly"
    FREE = "free"
    EXAM = "exam"


class TimetableStatus(str, enum.Enum):
    """Timetable status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class TimeSlot(TenantBaseModel, TimestampMixin):
    """
    Time slot definition for timetable.
    Defines periods/slots available for scheduling.
    """
    __tablename__ = "time_slots"
    
    # Identification
    name = Column(String(100), nullable=False)  # e.g., "Period 1", "Lunch Break"
    code = Column(String(50), nullable=True)  # e.g., "P1", "LB"
    
    # Timing
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=True)  # Calculated
    
    # Type
    slot_type = Column(SQLEnum(TimeSlotType), default=TimeSlotType.CLASS)
    
    # Order for display
    order = Column(Integer, default=0)
    
    # Days this slot applies to (if empty, applies to all days)
    applicable_days = Column(JSONB, default=[1, 2, 3, 4, 5])  # Mon-Fri by default
    
    # Academic year/term
    academic_year = Column(String(20), nullable=True)  # e.g., "2024-25"
    term = Column(String(50), nullable=True)  # e.g., "Term 1"
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Relationships
    timetable_entries = relationship("TimetableEntry", back_populates="time_slot", lazy="dynamic")
    
    __table_args__ = (
        CheckConstraint('end_time > start_time', name='ck_time_slot_valid_time'),
        UniqueConstraint('tenant_id', 'name', 'academic_year', name='uq_time_slot_tenant_name_year'),
    )
    
    def __repr__(self):
        return f"<TimeSlot {self.name} ({self.start_time}-{self.end_time})>"
    
    @property
    def duration(self) -> int:
        """Calculate duration in minutes."""
        if self.duration_minutes:
            return self.duration_minutes
        
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        return int((end - start).total_seconds() / 60)


class Room(TenantBaseModel, TimestampMixin):
    """
    Room/Classroom model for timetable scheduling.
    """
    __tablename__ = "rooms"
    
    # Identification
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=True)
    building = Column(String(100), nullable=True)
    floor = Column(String(20), nullable=True)
    
    # Capacity
    capacity = Column(Integer, nullable=True)
    
    # Type
    room_type = Column(String(50), default="classroom")  # classroom, lab, auditorium, etc.
    
    # Facilities
    facilities = Column(JSONB, default=[])  # e.g., ["projector", "ac", "smartboard"]
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Relationships
    timetable_entries = relationship("TimetableEntry", back_populates="room", lazy="dynamic")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', name='uq_room_tenant_name'),
    )
    
    def __repr__(self):
        return f"<Room {self.name}>"


class TimetableEntry(TenantBaseModel, TimestampMixin):
    """
    Individual timetable entry.
    Links a course/subject with teacher, room, and time slot.
    """
    __tablename__ = "timetable_entries"
    
    # Time and day
    time_slot_id = Column(UUID(as_uuid=True), ForeignKey("time_slots.id"), nullable=False, index=True)
    day_of_week = Column(SQLEnum(DayOfWeek), nullable=False, index=True)
    
    # What
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=True, index=True)
    subject_name = Column(String(200), nullable=True)  # Alternative to course_id
    
    # Who teaches
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True, index=True)
    
    # Where
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True, index=True)
    
    # For which class/section
    class_name = Column(String(100), nullable=True, index=True)
    section = Column(String(50), nullable=True)
    
    # Academic period
    academic_year = Column(String(20), nullable=True)
    term = Column(String(50), nullable=True)
    
    # Validity
    effective_from = Column(DateTime, nullable=True)
    effective_until = Column(DateTime, nullable=True)
    
    # Status
    status = Column(SQLEnum(TimetableStatus), default=TimetableStatus.ACTIVE)
    
    # Notes
    notes = Column(String(500), nullable=True)
    
    # Relationships
    time_slot = relationship("TimeSlot", back_populates="timetable_entries")
    course = relationship("Course", foreign_keys=[course_id])
    teacher = relationship("Staff", foreign_keys=[teacher_id])
    room = relationship("Room", back_populates="timetable_entries")
    
    __table_args__ = (
        # Prevent double-booking of teacher
        UniqueConstraint(
            'tenant_id', 'time_slot_id', 'day_of_week', 'teacher_id', 'academic_year',
            name='uq_timetable_teacher_slot'
        ),
        # Prevent double-booking of room
        UniqueConstraint(
            'tenant_id', 'time_slot_id', 'day_of_week', 'room_id', 'academic_year',
            name='uq_timetable_room_slot'
        ),
        # Prevent double-booking of class/section
        UniqueConstraint(
            'tenant_id', 'time_slot_id', 'day_of_week', 'class_name', 'section', 'academic_year',
            name='uq_timetable_class_slot'
        ),
    )
    
    def __repr__(self):
        return f"<TimetableEntry {self.day_of_week.name} {self.time_slot_id}>"
    
    @property
    def is_active(self) -> bool:
        """Check if entry is currently active."""
        if self.status != TimetableStatus.ACTIVE:
            return False
        
        now = datetime.utcnow()
        
        if self.effective_from and self.effective_from > now:
            return False
        
        if self.effective_until and self.effective_until < now:
            return False
        
        return True


class TimetableConflict(TenantBaseModel):
    """
    Model to track detected timetable conflicts.
    """
    __tablename__ = "timetable_conflicts"
    
    # Conflicting entries
    entry_1_id = Column(UUID(as_uuid=True), ForeignKey("timetable_entries.id"), nullable=False)
    entry_2_id = Column(UUID(as_uuid=True), ForeignKey("timetable_entries.id"), nullable=False)
    
    # Conflict type
    conflict_type = Column(String(50), nullable=False)  # teacher, room, class
    
    # Description
    description = Column(String(500), nullable=True)
    
    # Resolution
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(String(500), nullable=True)
    
    # Detection timestamp
    detected_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<TimetableConflict {self.conflict_type}>"
