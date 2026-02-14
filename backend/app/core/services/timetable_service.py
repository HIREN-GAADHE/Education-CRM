"""
Timetable service for scheduling and conflict detection.
"""
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
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
        Check for scheduling conflicts using time-based overlap.
        
        Returns list of conflicts with details.
        """
        conflicts = []
        
        # 1. Get the current time slot to know its timing
        stmt = select(TimeSlot).where(TimeSlot.id == time_slot_id)
        result = await self.db.execute(stmt)
        current_slot = result.scalar_one_or_none()
        
        if not current_slot:
            # Should not happen if foreign key valid, but handle gracefully
            return []

        # 2. Find ALL overlapping time slots (including the current one)
        # Overlap logic: (SlotA.Start < SlotB.End) AND (SlotA.End > SlotB.Start)
        overlap_query = select(TimeSlot.id).where(
            and_(
                TimeSlot.tenant_id == tenant_id,
                TimeSlot.is_active == True,
                TimeSlot.start_time < current_slot.end_time,
                TimeSlot.end_time > current_slot.start_time
            )
        )
        if academic_year:
            overlap_query = overlap_query.where(
                or_(TimeSlot.academic_year == academic_year, TimeSlot.academic_year.is_(None))
            )

        overlap_result = await self.db.execute(overlap_query)
        overlapping_slot_ids = list(overlap_result.scalars().all())
        
        if not overlapping_slot_ids:
            overlapping_slot_ids = [time_slot_id] # Should at least include itself if active

        # 3. Base Conditions for Entry Conflict
        base_conditions = [
            TimetableEntry.tenant_id == tenant_id,
            TimetableEntry.time_slot_id.in_(overlapping_slot_ids), # Check ANY overlapping slot
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.status == TimetableStatus.ACTIVE,
        ]
        
        if academic_year:
            base_conditions.append(TimetableEntry.academic_year == academic_year)
        
        if exclude_entry_id:
            base_conditions.append(TimetableEntry.id != exclude_entry_id)
        
        # 4. Check teacher conflict
        if teacher_id:
            query = select(TimetableEntry).options(selectinload(TimetableEntry.time_slot)).where(
                and_(*base_conditions, TimetableEntry.teacher_id == teacher_id)
            )
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                conflicts.append({
                    "type": "teacher",
                    "entry_id": str(existing.id),
                    "message": f"Teacher is already assigned to {existing.class_name}-{existing.section} in {existing.time_slot.name}",
                    "class_name": existing.class_name,
                    "section": existing.section,
                    "blocking_slot": existing.time_slot.name,
                    "blocking_subject": existing.subject_name,
                })
        
        # 5. Check room conflict
        if room_id:
            query = select(TimetableEntry).options(selectinload(TimetableEntry.time_slot)).where(
                and_(*base_conditions, TimetableEntry.room_id == room_id)
            )
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                conflicts.append({
                    "type": "room",
                    "entry_id": str(existing.id),
                    "message": f"Room is already booked for {existing.class_name} in {existing.time_slot.name}",
                    "class_name": existing.class_name,
                    "section": existing.section,
                    "blocking_slot": existing.time_slot.name,
                })
        
        # 6. Check class/section conflict
        if class_name:
            class_conditions = base_conditions.copy()
            class_conditions.append(TimetableEntry.class_name == class_name)
            if section:
                class_conditions.append(TimetableEntry.section == section)
            
            query = select(TimetableEntry).options(selectinload(TimetableEntry.time_slot)).where(and_(*class_conditions))
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                conflicts.append({
                    "type": "class",
                    "entry_id": str(existing.id),
                    "message": f"Class has {existing.subject_name} assigned in {existing.time_slot.name}",
                    "subject_name": existing.subject_name,
                    "blocking_slot": existing.time_slot.name,
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
