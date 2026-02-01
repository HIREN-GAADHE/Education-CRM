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
    attendance_type: AttendanceType  # student or staff
    student_id: Optional[UUID] = None
    staff_id: Optional[UUID] = None
    attendance_date: date
    status: AttendanceStatus = AttendanceStatus.PRESENT
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
    status: Optional[AttendanceStatus] = None
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
            Attendance.attendance_type == AttendanceType.STUDENT,
            Attendance.tenant_id == current_user.tenant_id,  # Tenant isolation
            Attendance.is_deleted == False  # Exclude soft-deleted records
        )
        
        if course:
            query = query.where(Attendance.course == course)
        if section:
            query = query.where(Attendance.section == section)
        
        result = await db.execute(query)
        records = result.scalars().all()
        
        present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
        absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
        late = sum(1 for r in records if r.status == AttendanceStatus.LATE)
        half_day = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
        on_leave = sum(1 for r in records if r.status == AttendanceStatus.ON_LEAVE)
        
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
                existing_record.status = AttendanceStatus(record.get("status", "present"))
                existing_record.remarks = record.get("remarks")
                existing_record.course = bulk_data.course or existing_record.course
                existing_record.section = bulk_data.section or existing_record.section
                existing_record.subject = bulk_data.subject or existing_record.subject
                updated_count += 1
            else:
                # Create new record
                attendance = Attendance(
                    attendance_type=AttendanceType.STUDENT,
                    student_id=record.get("student_id"),
                    attendance_date=bulk_data.attendance_date,
                    status=AttendanceStatus(record.get("status", "present")),
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

class StudentAttendanceHistory(BaseModel):
    student_id: UUID
    student_name: str
    admission_number: str
    roll_number: Optional[str] = None
    attendance: dict[str, dict]  # date: {status, remarks}


class AttendanceHistoryResponse(BaseModel):
    start_date: date
    end_date: date
    students: List[StudentAttendanceHistory]


@router.get("/history", response_model=AttendanceHistoryResponse)
@require_permission("attendance", "read")
async def get_attendance_history(
    request: Request,
    start_date: date = Query(...),
    end_date: date = Query(...),
    course: str = Query(...),
    section: str = Query(...),
    class_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get attendance history for a class within a date range."""
    # 1. Fetch all students in the class
    stmt = select(Student).where(
        Student.tenant_id == current_user.tenant_id,
        Student.status == "active",
        Student.is_deleted == False
    )

    if class_id:
        stmt = stmt.where(Student.class_id == class_id)
    else:
        stmt = stmt.where(
            Student.course == course,
            Student.section == section
        )
    
    stmt = stmt.order_by(Student.roll_number, Student.first_name)
    
    students_result = await db.execute(stmt)
    students = students_result.scalars().all()
    
    if not students:
        return AttendanceHistoryResponse(
            start_date=start_date,
            end_date=end_date,
            students=[]
        )
    
    # 2. Fetch all attendance records for this class in range
    att_stmt = select(Attendance).where(
        Attendance.tenant_id == current_user.tenant_id,
        Attendance.course == course,
        Attendance.section == section,
        Attendance.attendance_date >= start_date,
        Attendance.attendance_date <= end_date,
        Attendance.is_deleted == False
    )
    
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()
    
    # 3. Build the map
    # student_id -> date -> record
    history_map = {}
    for record in records:
        sid = str(record.student_id)
        if sid not in history_map:
            history_map[sid] = {}
        
        history_map[sid][record.attendance_date.isoformat()] = {
            "status": record.status.value,
            "remarks": record.remarks
        }
    
    # 4. Construct response
    history_list = []
    for student in students:
        sid = str(student.id)
        history_list.append(StudentAttendanceHistory(
            student_id=student.id,
            student_name=f"{student.first_name} {student.last_name}",
            admission_number=student.admission_number,
            roll_number=student.roll_number,
            attendance=history_map.get(sid, {})
        ))
    
    return AttendanceHistoryResponse(
        start_date=start_date,
        end_date=end_date,
        students=history_list
    )
