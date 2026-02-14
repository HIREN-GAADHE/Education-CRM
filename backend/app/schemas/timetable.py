"""
Timetable schemas for API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, time
from enum import Enum
from uuid import UUID


class DayOfWeekEnum(int, Enum):
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6
    SUNDAY = 7


class TimeSlotTypeEnum(str, Enum):
    CLASS = "class"
    BREAK = "break"
    LUNCH = "lunch"
    ASSEMBLY = "assembly"
    FREE = "free"
    EXAM = "exam"


class TimetableStatusEnum(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


# ============== Time Slot Schemas ==============

class TimeSlotBase(BaseModel):
    """Base schema for time slot."""
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    start_time: time
    end_time: time
    slot_type: TimeSlotTypeEnum = TimeSlotTypeEnum.CLASS
    order: int = 0
    applicable_days: Any = [1, 2, 3, 4, 5]
    academic_year: Optional[str] = None
    term: Optional[str] = None
    is_active: bool = True


class TimeSlotCreate(TimeSlotBase):
    """Schema for creating a time slot."""
    pass


class TimeSlotUpdate(BaseModel):
    """Schema for updating a time slot."""
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_type: Optional[TimeSlotTypeEnum] = None
    order: Optional[int] = None
    applicable_days: Optional[Any] = None
    is_active: Optional[bool] = None


class TimeSlotResponse(TimeSlotBase):
    """Schema for time slot response."""
    id: UUID
    tenant_id: UUID
    duration_minutes: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class TimeSlotListResponse(BaseModel):
    """Schema for list of time slots."""
    items: List[TimeSlotResponse]
    total: int


# ============== Room Schemas ==============

class RoomBase(BaseModel):
    """Base schema for room."""
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    building: Optional[str] = None
    floor: Optional[str] = None
    capacity: Optional[int] = None
    room_type: str = "classroom"
    facilities: List[str] = []
    is_active: bool = True


class RoomCreate(RoomBase):
    """Schema for creating a room."""
    pass


class RoomUpdate(BaseModel):
    """Schema for updating a room."""
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    building: Optional[str] = None
    floor: Optional[str] = None
    capacity: Optional[int] = None
    room_type: Optional[str] = None
    facilities: Optional[List[str]] = None
    is_active: Optional[bool] = None


class RoomResponse(RoomBase):
    """Schema for room response."""
    id: UUID
    tenant_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class RoomListResponse(BaseModel):
    """Schema for list of rooms."""
    items: List[RoomResponse]
    total: int


# ============== Timetable Entry Schemas ==============

class TimetableEntryBase(BaseModel):
    """Base schema for timetable entry."""
    time_slot_id: UUID
    day_of_week: DayOfWeekEnum
    course_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    teacher_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_until: Optional[datetime] = None
    notes: Optional[str] = None


class TimetableEntryCreate(TimetableEntryBase):
    """Schema for creating a timetable entry."""
    pass


class TimetableEntryUpdate(BaseModel):
    """Schema for updating a timetable entry."""
    time_slot_id: Optional[UUID] = None
    day_of_week: Optional[DayOfWeekEnum] = None
    course_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    teacher_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_until: Optional[datetime] = None
    status: Optional[TimetableStatusEnum] = None
    notes: Optional[str] = None


class TimetableEntryResponse(BaseModel):
    """Schema for timetable entry response."""
    id: UUID
    tenant_id: UUID
    time_slot_id: UUID
    day_of_week: DayOfWeekEnum
    course_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    teacher_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    status: TimetableStatusEnum
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class TimetableEntryDetailResponse(TimetableEntryResponse):
    """Detailed timetable entry with expanded relationships."""
    time_slot: Optional[TimeSlotResponse] = None
    room: Optional[RoomResponse] = None
    # course and teacher would be added with their own response schemas


class TimetableEntryListResponse(BaseModel):
    """Schema for list of timetable entries."""
    items: List[TimetableEntryResponse]
    total: int


# ============== Timetable View Schemas ==============

class TimetableGridCell(BaseModel):
    """A single cell in the timetable grid."""
    entry_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    teacher_name: Optional[str] = None
    room_name: Optional[str] = None
    slot_type: str = "class"
    is_empty: bool = True


class TimetableGridRow(BaseModel):
    """A row in the timetable grid (one time slot)."""
    time_slot: TimeSlotResponse
    cells: Dict[int, TimetableGridCell]  # Key is day_of_week


class TimetableGridResponse(BaseModel):
    """Complete timetable grid view."""
    class_name: Optional[str] = None
    section: Optional[str] = None
    teacher_id: Optional[UUID] = None
    academic_year: Optional[str] = None
    rows: List[TimetableGridRow]
    days: List[int] = [1, 2, 3, 4, 5, 6]  # Active days


# ============== Conflict Schemas ==============

class ConflictCheckRequest(BaseModel):
    """Schema for checking conflicts."""
    time_slot_id: UUID
    day_of_week: DayOfWeekEnum
    teacher_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    academic_year: Optional[str] = None
    exclude_entry_id: Optional[UUID] = None


class ConflictResponse(BaseModel):
    """Schema for conflict response."""
    has_conflict: bool
    conflicts: List[Dict[str, Any]] = []
    message: str


# ============== Bulk Operations ==============

class BulkTimetableCreate(BaseModel):
    """Schema for bulk creating timetable entries."""
    entries: List[TimetableEntryCreate]


class BulkTimetableResponse(BaseModel):
    """Schema for bulk operation response."""
    created: int
    failed: int
    errors: List[Dict[str, Any]] = []
