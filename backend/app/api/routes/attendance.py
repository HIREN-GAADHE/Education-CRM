"""
Attendance API Router - CRUD operations for attendance tracking
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime, date, time
import math
import logging

from app.config.database import get_db
from app.models import Attendance, AttendanceStatus, AttendanceType, Student, Staff, Tenant
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attendance", tags=["Attendance"])


# Pydantic Schemas
class AttendanceBase(BaseModel):
    attendance_type: str  # student or staff
    student_id: Optional[UUID] = None
    staff_id: Optional[UUID] = None
    attendance_date: date
    status: str = "present"
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    course: Optional[str] = None
    section: Optional[str] = None
    subject: Optional[str] = None
    remarks: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    pass


class BulkAttendanceCreate(BaseModel):
    attendance_date: date
    course: Optional[str] = None
    section: Optional[str] = None
    subject: Optional[str] = None
    records: List[dict]  # [{student_id, status, remarks}]


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    remarks: Optional[str] = None


class StudentInfo(BaseModel):
    id: UUID
    admission_number: str
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class AttendanceResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    attendance_type: str
    student_id: Optional[UUID] = None
    staff_id: Optional[UUID] = None
    attendance_date: date
    status: str
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    course: Optional[str] = None
    section: Optional[str] = None
    subject: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    student: Optional[StudentInfo] = None
    
    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    items: List[AttendanceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AttendanceSummary(BaseModel):
    total_students: int
    present: int
    absent: int
    late: int
    half_day: int
    on_leave: int
    attendance_date: date


@router.get("", response_model=AttendanceListResponse)
@require_permission("attendance", "read")
async def list_attendance(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    attendance_date: Optional[date] = None,
    attendance_type: Optional[str] = None,
    course: Optional[str] = None,
    section: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List attendance records with filtering."""
    try:
        query = select(Attendance).where(
            Attendance.tenant_id == current_user.tenant_id,  # Tenant isolation
            Attendance.is_deleted == False  # Exclude soft-deleted records
        ).options(selectinload(Attendance.student))
        
        if attendance_date:
            query = query.where(Attendance.attendance_date == attendance_date)
        
        if attendance_type:
            query = query.where(Attendance.attendance_type == attendance_type)
        
        if course:
            query = query.where(Attendance.course == course)
        
        if section:
            query = query.where(Attendance.section == section)
        
        if status_filter:
            query = query.where(Attendance.status == status_filter)
        
        count_query = select(func.count(Attendance.id)).where(
            Attendance.tenant_id == current_user.tenant_id,
            Attendance.is_deleted == False  # Exclude soft-deleted from count
        )
        if attendance_date:
            count_query = count_query.where(Attendance.attendance_date == attendance_date)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(Attendance.created_at.desc())
        
        result = await db.execute(query)
        records = result.scalars().unique().all()
        
        return AttendanceListResponse(
            items=records,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing attendance: {e}")
        raise HTTPException(status_code=500, detail="An error occurred")


@router.get("/summary", response_model=AttendanceSummary)
@require_permission("attendance", "read")
async def get_attendance_summary(
    request: Request,
    attendance_date: date = Query(...),
    course: Optional[str] = None,
    section: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get attendance summary for a specific date."""
    try:
        query = select(Attendance).where(
            Attendance.attendance_date == attendance_date,
            Attendance.attendance_type == "student",
            Attendance.tenant_id == current_user.tenant_id,  # Tenant isolation
            Attendance.is_deleted == False  # Exclude soft-deleted records
        )
        
        if course:
            query = query.where(Attendance.course == course)
        if section:
            query = query.where(Attendance.section == section)
        
        result = await db.execute(query)
        records = result.scalars().all()
        
        present = sum(1 for r in records if r.status == "present")
        absent = sum(1 for r in records if r.status == "absent")
        late = sum(1 for r in records if r.status == "late")
        half_day = sum(1 for r in records if r.status == "half_day")
        on_leave = sum(1 for r in records if r.status == "on_leave")
        
        return AttendanceSummary(
            total_students=len(records),
            present=present,
            absent=absent,
            late=late,
            half_day=half_day,
            on_leave=on_leave,
            attendance_date=attendance_date,
        )
    except Exception as e:
        logger.error(f"Error getting attendance summary: {e}")
        raise HTTPException(status_code=500, detail="An error occurred")


@router.post("", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
@require_permission("attendance", "create")
async def create_attendance(
    request: Request,
    attendance_data: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a single attendance record."""
    try:
        # Check for duplicate within tenant
        existing = await db.execute(
            select(Attendance).where(
                Attendance.attendance_date == attendance_data.attendance_date,
                Attendance.student_id == attendance_data.student_id if attendance_data.student_id else Attendance.staff_id == attendance_data.staff_id,
                Attendance.tenant_id == current_user.tenant_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Attendance already marked for this date")
        
        attendance = Attendance(**attendance_data.model_dump())
        attendance.tenant_id = current_user.tenant_id
        
        db.add(attendance)
        await db.commit()
        await db.refresh(attendance)
        
        return attendance
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating attendance: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred")


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
@require_permission("attendance", "create")
async def create_bulk_attendance(
    request: Request,
    bulk_data: BulkAttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create attendance records for multiple students at once."""
    try:
        created_count = 0
        updated_count = 0
        for record in bulk_data.records:
            # Check for existing record within tenant
            existing = await db.execute(
                select(Attendance).where(
                    Attendance.attendance_date == bulk_data.attendance_date,
                    Attendance.student_id == record.get("student_id"),
                    Attendance.tenant_id == current_user.tenant_id,
                    Attendance.is_deleted == False
                )
            )
            existing_record = existing.scalar_one_or_none()
            
            if existing_record:
                # Update existing record
                existing_record.status = record.get("status", "present")
                existing_record.remarks = record.get("remarks")
                existing_record.course = bulk_data.course or existing_record.course
                existing_record.section = bulk_data.section or existing_record.section
                existing_record.subject = bulk_data.subject or existing_record.subject
                updated_count += 1
            else:
                # Create new record
                attendance = Attendance(
                    attendance_type="student",
                    student_id=record.get("student_id"),
                    attendance_date=bulk_data.attendance_date,
                    status=record.get("status", "present"),
                    course=bulk_data.course,
                    section=bulk_data.section,
                    subject=bulk_data.subject,
                    remarks=record.get("remarks"),
                    tenant_id=current_user.tenant_id,
                )
                db.add(attendance)
                created_count += 1
        
        await db.commit()
        
        return {"message": f"Created {created_count}, updated {updated_count} attendance records", "created": created_count, "updated": updated_count}
    except Exception as e:
        logger.error(f"Error creating bulk attendance: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred")


@router.put("/{attendance_id}", response_model=AttendanceResponse)
@require_permission("attendance", "update")
async def update_attendance(
    request: Request,
    attendance_id: UUID,
    attendance_data: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an attendance record."""
    try:
        result = await db.execute(
            select(Attendance).where(
                Attendance.id == attendance_id,
                Attendance.tenant_id == current_user.tenant_id
            )
        )
        attendance = result.scalar_one_or_none()
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        update_data = attendance_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(attendance, field, value)
        
        await db.commit()
        await db.refresh(attendance)
        return attendance
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while updating attendance")


@router.delete("/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("attendance", "delete")
async def delete_attendance(
    request: Request,
    attendance_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an attendance record (soft delete for audit trail)."""
    try:
        result = await db.execute(
            select(Attendance).where(
                Attendance.id == attendance_id,
                Attendance.tenant_id == current_user.tenant_id,
                Attendance.is_deleted == False
            )
        )
        attendance = result.scalar_one_or_none()
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        # Soft delete - preserve for audit trail
        attendance.is_deleted = True
        attendance.deleted_at = datetime.utcnow()
        attendance.deleted_by = current_user.id
        await db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while deleting attendance")

