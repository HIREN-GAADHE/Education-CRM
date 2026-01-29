"""
Timetable service for scheduling and conflict detection.
"""
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from uuid import UUID

from app.models.timetable import (
    TimeSlot,
    Room,
    TimetableEntry,
    TimetableConflict,
    DayOfWeek,
    TimetableStatus,
)
from app.models.staff import Staff
from app.models.course import Course

logger = logging.getLogger(__name__)


class TimetableService:
    """
    Service for managing timetables and detecting conflicts.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ============== Time Slots ==============
    
    async def get_time_slots(
        self,
        tenant_id: str,
        academic_year: Optional[str] = None,
        active_only: bool = True,
    ) -> List[TimeSlot]:
        """Get all time slots for a tenant."""
        query = select(TimeSlot).where(TimeSlot.tenant_id == tenant_id)
        
        if active_only:
            query = query.where(TimeSlot.is_active == True)
        
        if academic_year:
            query = query.where(TimeSlot.academic_year == academic_year)
        
        query = query.order_by(TimeSlot.order, TimeSlot.start_time)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_time_slot(
        self,
        tenant_id: str,
        **kwargs,
    ) -> TimeSlot:
        """Create a new time slot."""
        time_slot = TimeSlot(tenant_id=tenant_id, **kwargs)
        self.db.add(time_slot)
        await self.db.commit()
        await self.db.refresh(time_slot)
        return time_slot
    
    # ============== Rooms ==============
    
    async def get_rooms(
        self,
        tenant_id: str,
        active_only: bool = True,
        room_type: Optional[str] = None,
    ) -> List[Room]:
        """Get all rooms for a tenant."""
        query = select(Room).where(Room.tenant_id == tenant_id)
        
        if active_only:
            query = query.where(Room.is_active == True)
        
        if room_type:
            query = query.where(Room.room_type == room_type)
        
        query = query.order_by(Room.name)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_room(
        self,
        tenant_id: str,
        **kwargs,
    ) -> Room:
        """Create a new room."""
        room = Room(tenant_id=tenant_id, **kwargs)
        self.db.add(room)
        await self.db.commit()
        await self.db.refresh(room)
        return room
    
    # ============== Timetable Entries ==============
    
    async def check_conflicts(
        self,
        tenant_id: str,
        time_slot_id: str,
        day_of_week: DayOfWeek,
        teacher_id: Optional[str] = None,
        room_id: Optional[str] = None,
        class_name: Optional[str] = None,
        section: Optional[str] = None,
        academic_year: Optional[str] = None,
        exclude_entry_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Check for scheduling conflicts.
        
        Returns list of conflicts with details.
        """
        conflicts = []
        
        base_conditions = [
            TimetableEntry.tenant_id == tenant_id,
            TimetableEntry.time_slot_id == time_slot_id,
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.status == TimetableStatus.ACTIVE,
        ]
        
        if academic_year:
            base_conditions.append(TimetableEntry.academic_year == academic_year)
        
        if exclude_entry_id:
            base_conditions.append(TimetableEntry.id != exclude_entry_id)
        
        # Check teacher conflict
        if teacher_id:
            query = select(TimetableEntry).where(
                and_(*base_conditions, TimetableEntry.teacher_id == teacher_id)
            )
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                conflicts.append({
                    "type": "teacher",
                    "entry_id": str(existing.id),
                    "message": f"Teacher is already assigned to another class at this time",
                    "class_name": existing.class_name,
                    "section": existing.section,
                })
        
        # Check room conflict
        if room_id:
            query = select(TimetableEntry).where(
                and_(*base_conditions, TimetableEntry.room_id == room_id)
            )
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                conflicts.append({
                    "type": "room",
                    "entry_id": str(existing.id),
                    "message": f"Room is already booked at this time",
                    "class_name": existing.class_name,
                    "section": existing.section,
                })
        
        # Check class/section conflict
        if class_name:
            class_conditions = base_conditions.copy()
            class_conditions.append(TimetableEntry.class_name == class_name)
            if section:
                class_conditions.append(TimetableEntry.section == section)
            
            query = select(TimetableEntry).where(and_(*class_conditions))
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                conflicts.append({
                    "type": "class",
                    "entry_id": str(existing.id),
                    "message": f"Class already has a subject assigned at this time",
                    "subject_name": existing.subject_name,
                })
        
        return conflicts
    
    async def create_entry(
        self,
        tenant_id: str,
        check_conflicts: bool = True,
        **kwargs,
    ) -> Tuple[TimetableEntry, List[Dict[str, Any]]]:
        """
        Create a new timetable entry.
        
        Returns tuple of (entry, conflicts).
        If check_conflicts is True and conflicts exist, entry is not created.
        """
        conflicts = []
        
        if check_conflicts:
            conflicts = await self.check_conflicts(
                tenant_id=tenant_id,
                time_slot_id=kwargs.get("time_slot_id"),
                day_of_week=kwargs.get("day_of_week"),
                teacher_id=kwargs.get("teacher_id"),
                room_id=kwargs.get("room_id"),
                class_name=kwargs.get("class_name"),
                section=kwargs.get("section"),
                academic_year=kwargs.get("academic_year"),
            )
            
            if conflicts:
                return None, conflicts
        
        entry = TimetableEntry(tenant_id=tenant_id, **kwargs)
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        
        return entry, []
    
    async def get_entries(
        self,
        tenant_id: str,
        class_name: Optional[str] = None,
        section: Optional[str] = None,
        teacher_id: Optional[str] = None,
        room_id: Optional[str] = None,
        day_of_week: Optional[DayOfWeek] = None,
        academic_year: Optional[str] = None,
        active_only: bool = True,
    ) -> List[TimetableEntry]:
        """Get timetable entries with filters."""
        query = select(TimetableEntry).where(TimetableEntry.tenant_id == tenant_id)
        
        if active_only:
            query = query.where(TimetableEntry.status == TimetableStatus.ACTIVE)
        
        if class_name:
            query = query.where(TimetableEntry.class_name == class_name)
        
        if section:
            query = query.where(TimetableEntry.section == section)
        
        if teacher_id:
            query = query.where(TimetableEntry.teacher_id == teacher_id)
        
        if room_id:
            query = query.where(TimetableEntry.room_id == room_id)
        
        if day_of_week:
            query = query.where(TimetableEntry.day_of_week == day_of_week)
        
        if academic_year:
            query = query.where(TimetableEntry.academic_year == academic_year)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_timetable_grid(
        self,
        tenant_id: str,
        class_name: Optional[str] = None,
        section: Optional[str] = None,
        teacher_id: Optional[str] = None,
        academic_year: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get timetable as a grid structure for display.
        
        Returns dict with:
        - time_slots: List of time slots
        - days: List of day numbers
        - grid: Dict[time_slot_id][day] = entry details
        """
        # Get time slots
        time_slots = await self.get_time_slots(tenant_id, academic_year)
        
        # Get entries
        entries = await self.get_entries(
            tenant_id=tenant_id,
            class_name=class_name,
            section=section,
            teacher_id=teacher_id,
            academic_year=academic_year,
        )
        
        # Build grid
        grid = {}
        for slot in time_slots:
            grid[str(slot.id)] = {}
            for day in range(1, 8):  # Monday to Sunday
                grid[str(slot.id)][day] = {
                    "entry_id": None,
                    "subject_name": None,
                    "teacher_name": None,
                    "room_name": None,
                    "is_empty": True,
                }
        
        # Fill in entries
        for entry in entries:
            slot_id = str(entry.time_slot_id)
            day = entry.day_of_week.value
            
            if slot_id in grid:
                # Get teacher name if available
                teacher_name = None
                if entry.teacher_id:
                    teacher_result = await self.db.execute(
                        select(Staff).where(Staff.id == entry.teacher_id)
                    )
                    teacher = teacher_result.scalar_one_or_none()
                    if teacher:
                        teacher_name = f"{teacher.first_name} {teacher.last_name or ''}".strip()
                
                # Get room name if available
                room_name = None
                if entry.room_id:
                    room_result = await self.db.execute(
                        select(Room).where(Room.id == entry.room_id)
                    )
                    room = room_result.scalar_one_or_none()
                    if room:
                        room_name = room.name
                
                grid[slot_id][day] = {
                    "entry_id": str(entry.id),
                    "subject_name": entry.subject_name,
                    "teacher_name": teacher_name,
                    "room_name": room_name,
                    "is_empty": False,
                }
        
        return {
            "time_slots": time_slots,
            "days": [1, 2, 3, 4, 5, 6],  # Mon-Sat
            "grid": grid,
            "class_name": class_name,
            "section": section,
            "teacher_id": teacher_id,
            "academic_year": academic_year,
        }
    
    async def get_teacher_schedule(
        self,
        tenant_id: str,
        teacher_id: str,
        academic_year: Optional[str] = None,
    ) -> List[TimetableEntry]:
        """Get all timetable entries for a teacher."""
        return await self.get_entries(
            tenant_id=tenant_id,
            teacher_id=teacher_id,
            academic_year=academic_year,
        )
    
    async def get_room_schedule(
        self,
        tenant_id: str,
        room_id: str,
        academic_year: Optional[str] = None,
    ) -> List[TimetableEntry]:
        """Get all timetable entries for a room."""
        return await self.get_entries(
            tenant_id=tenant_id,
            room_id=room_id,
            academic_year=academic_year,
        )
