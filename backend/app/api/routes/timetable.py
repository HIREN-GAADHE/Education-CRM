"""
Timetable API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from app.config.database import get_db
from app.core.middleware.auth import get_current_user
from app.models.user import User
from app.models.timetable import (
    TimeSlot,
    Room,
    TimetableEntry,
    DayOfWeek,
    TimetableStatus,
    TimeSlotType,
)
from app.schemas.timetable import (
    TimeSlotCreate,
    TimeSlotUpdate,
    TimeSlotResponse,
    TimeSlotListResponse,
    RoomCreate,
    RoomUpdate,
    RoomResponse,
    RoomListResponse,
    TimetableEntryCreate,
    TimetableEntryUpdate,
    TimetableEntryResponse,
    TimetableEntryListResponse,
    ConflictCheckRequest,
    ConflictResponse,
    BulkTimetableCreate,
    BulkTimetableResponse,
)
from app.core.services.timetable_service import TimetableService

router = APIRouter(prefix="/timetable", tags=["Timetable"])


# ============== Time Slot Endpoints ==============

@router.get("/time-slots", response_model=TimeSlotListResponse)
async def list_time_slots(
    academic_year: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all time slots."""
    service = TimetableService(db)
    slots = await service.get_time_slots(
        tenant_id=str(current_user.tenant_id),
        academic_year=academic_year,
        active_only=active_only,
    )
    return TimeSlotListResponse(
        items=[TimeSlotResponse.model_validate(s) for s in slots],
        total=len(slots),
    )


@router.post("/time-slots", response_model=TimeSlotResponse, status_code=status.HTTP_201_CREATED)
async def create_time_slot(
    slot_data: TimeSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new time slot."""
    service = TimetableService(db)
    slot = await service.create_time_slot(
        tenant_id=str(current_user.tenant_id),
        name=slot_data.name,
        code=slot_data.code,
        start_time=slot_data.start_time,
        end_time=slot_data.end_time,
        slot_type=TimeSlotType(slot_data.slot_type.value),
        order=slot_data.order,
        applicable_days=slot_data.applicable_days,
        academic_year=slot_data.academic_year,
        term=slot_data.term,
        is_active=slot_data.is_active,
    )
    return TimeSlotResponse.model_validate(slot)


@router.get("/time-slots/{slot_id}", response_model=TimeSlotResponse)
async def get_time_slot(
    slot_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific time slot."""
    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.id == slot_id,
            TimeSlot.tenant_id == current_user.tenant_id,
        )
    )
    slot = result.scalar_one_or_none()
    
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time slot not found",
        )
    
    return TimeSlotResponse.model_validate(slot)


@router.put("/time-slots/{slot_id}", response_model=TimeSlotResponse)
async def update_time_slot(
    slot_id: UUID,
    slot_data: TimeSlotUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a time slot."""
    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.id == slot_id,
            TimeSlot.tenant_id == current_user.tenant_id,
        )
    )
    slot = result.scalar_one_or_none()
    
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time slot not found",
        )
    
    # Update fields
    update_data = slot_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(slot, field, value)
    
    await db.commit()
    await db.refresh(slot)
    
    return TimeSlotResponse.model_validate(slot)


@router.delete("/time-slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_slot(
    slot_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a time slot."""
    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.id == slot_id,
            TimeSlot.tenant_id == current_user.tenant_id,
        )
    )
    slot = result.scalar_one_or_none()
    
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time slot not found",
        )
    
    await db.delete(slot)
    await db.commit()


# ============== Room Endpoints ==============

@router.get("/rooms", response_model=RoomListResponse)
async def list_rooms(
    room_type: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all rooms."""
    service = TimetableService(db)
    rooms = await service.get_rooms(
        tenant_id=str(current_user.tenant_id),
        active_only=active_only,
        room_type=room_type,
    )
    return RoomListResponse(
        items=[RoomResponse.model_validate(r) for r in rooms],
        total=len(rooms),
    )


@router.post("/rooms", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    room_data: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new room."""
    service = TimetableService(db)
    room = await service.create_room(
        tenant_id=str(current_user.tenant_id),
        **room_data.model_dump(),
    )
    return RoomResponse.model_validate(room)


@router.put("/rooms/{room_id}", response_model=RoomResponse)
async def update_room(
    room_id: UUID,
    room_data: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a room."""
    result = await db.execute(
        select(Room).where(
            Room.id == room_id,
            Room.tenant_id == current_user.tenant_id,
        )
    )
    room = result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )
    
    # Update fields
    update_data = room_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(room, field, value)
    
    await db.commit()
    await db.refresh(room)
    
    return RoomResponse.model_validate(room)


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a room."""
    result = await db.execute(
        select(Room).where(
            Room.id == room_id,
            Room.tenant_id == current_user.tenant_id,
        )
    )
    room = result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )
    
    await db.delete(room)
    await db.commit()


# ============== Timetable Entry Endpoints ==============

@router.get("/entries", response_model=TimetableEntryListResponse)
async def list_entries(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    teacher_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    day: Optional[int] = Query(None, ge=1, le=7),
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List timetable entries with filters."""
    service = TimetableService(db)
    
    day_of_week = DayOfWeek(day) if day else None
    
    entries = await service.get_entries(
        tenant_id=str(current_user.tenant_id),
        class_name=class_name,
        section=section,
        teacher_id=str(teacher_id) if teacher_id else None,
        room_id=str(room_id) if room_id else None,
        day_of_week=day_of_week,
        academic_year=academic_year,
    )
    
    return TimetableEntryListResponse(
        items=[TimetableEntryResponse.model_validate(e) for e in entries],
        total=len(entries),
    )


@router.post("/entries", response_model=TimetableEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    entry_data: TimetableEntryCreate,
    check_conflicts: bool = Query(True, description="Check for scheduling conflicts"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new timetable entry."""
    service = TimetableService(db)
    
    entry, conflicts = await service.create_entry(
        tenant_id=str(current_user.tenant_id),
        check_conflicts=check_conflicts,
        time_slot_id=str(entry_data.time_slot_id),
        day_of_week=DayOfWeek(entry_data.day_of_week.value),
        course_id=str(entry_data.course_id) if entry_data.course_id else None,
        subject_name=entry_data.subject_name,
        teacher_id=str(entry_data.teacher_id) if entry_data.teacher_id else None,
        room_id=str(entry_data.room_id) if entry_data.room_id else None,
        class_name=entry_data.class_name,
        section=entry_data.section,
        academic_year=entry_data.academic_year,
        term=entry_data.term,
        effective_from=entry_data.effective_from,
        effective_until=entry_data.effective_until,
        notes=entry_data.notes,
    )
    
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Scheduling conflict detected",
                "conflicts": conflicts,
            }
        )
    
    return TimetableEntryResponse.model_validate(entry)


@router.put("/entries/{entry_id}", response_model=TimetableEntryResponse)
async def update_entry(
    entry_id: UUID,
    entry_data: TimetableEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a timetable entry."""
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == entry_id,
            TimetableEntry.tenant_id == current_user.tenant_id,
        )
    )
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found",
        )
    
    # Update fields
    update_data = entry_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)
    
    await db.commit()
    await db.refresh(entry)
    
    return TimetableEntryResponse.model_validate(entry)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a timetable entry."""
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == entry_id,
            TimetableEntry.tenant_id == current_user.tenant_id,
        )
    )
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found",
        )
    
    await db.delete(entry)
    await db.commit()


# ============== Conflict Check ==============

@router.post("/check-conflicts", response_model=ConflictResponse)
async def check_conflicts(
    request: ConflictCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check for scheduling conflicts."""
    service = TimetableService(db)
    
    conflicts = await service.check_conflicts(
        tenant_id=str(current_user.tenant_id),
        time_slot_id=str(request.time_slot_id),
        day_of_week=DayOfWeek(request.day_of_week.value),
        teacher_id=str(request.teacher_id) if request.teacher_id else None,
        room_id=str(request.room_id) if request.room_id else None,
        class_name=request.class_name,
        section=request.section,
        academic_year=request.academic_year,
        exclude_entry_id=str(request.exclude_entry_id) if request.exclude_entry_id else None,
    )
    
    return ConflictResponse(
        has_conflict=len(conflicts) > 0,
        conflicts=conflicts,
        message="Conflicts detected" if conflicts else "No conflicts",
    )


# ============== Grid View ==============

@router.get("/grid")
async def get_timetable_grid(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    teacher_id: Optional[UUID] = None,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get timetable in grid format for display."""
    service = TimetableService(db)
    
    grid_data = await service.get_timetable_grid(
        tenant_id=str(current_user.tenant_id),
        class_name=class_name,
        section=section,
        teacher_id=str(teacher_id) if teacher_id else None,
        academic_year=academic_year,
    )
    
    # Convert time_slots to response format
    grid_data["time_slots"] = [
        TimeSlotResponse.model_validate(s) for s in grid_data["time_slots"]
    ]
    
    return grid_data


# ============== Schedule Views ==============

@router.get("/teacher/{teacher_id}/schedule", response_model=TimetableEntryListResponse)
async def get_teacher_schedule(
    teacher_id: UUID,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get schedule for a specific teacher."""
    service = TimetableService(db)
    
    entries = await service.get_teacher_schedule(
        tenant_id=str(current_user.tenant_id),
        teacher_id=str(teacher_id),
        academic_year=academic_year,
    )
    
    return TimetableEntryListResponse(
        items=[TimetableEntryResponse.model_validate(e) for e in entries],
        total=len(entries),
    )


@router.get("/room/{room_id}/schedule", response_model=TimetableEntryListResponse)
async def get_room_schedule(
    room_id: UUID,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get schedule for a specific room."""
    service = TimetableService(db)
    
    entries = await service.get_room_schedule(
        tenant_id=str(current_user.tenant_id),
        room_id=str(room_id),
        academic_year=academic_year,
    )
    
    return TimetableEntryListResponse(
        items=[TimetableEntryResponse.model_validate(e) for e in entries],
        total=len(entries),
    )
