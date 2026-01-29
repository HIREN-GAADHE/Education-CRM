"""
Parent Portal API Routes
Provides read-only access for parents to view their children's academic data.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
from uuid import UUID

from app.config.database import get_db
from app.core.middleware.auth import get_current_active_user
from app.models import (
    User, Student, ParentStudent, Attendance, FeePayment,
    TimetableEntry, ExamResult, Examination
)


router = APIRouter(prefix="/parent", tags=["Parent Portal"])


# ============== Schemas ==============

class ChildSummary(BaseModel):
    """Summary information about a linked child."""
    id: UUID
    admission_number: str
    full_name: str
    course: Optional[str]
    section: Optional[str]
    year: Optional[int]
    avatar_url: Optional[str]
    relationship_type: str
    
    class Config:
        from_attributes = True


class AttendanceSummary(BaseModel):
    """Attendance summary for a child."""
    total_days: int
    present_days: int
    absent_days: int
    late_days: int
    percentage: float


class FeeSummary(BaseModel):
    """Fee summary for a child."""
    total_fees: float
    paid_amount: float
    pending_amount: float
    overdue_amount: float


class GradeSummary(BaseModel):
    """Grade summary for a child."""
    exam_name: str
    course_name: Optional[str]
    marks_obtained: float
    max_marks: float
    percentage: float
    grade: Optional[str]
    exam_date: Optional[date]


class TimetableSlot(BaseModel):
    """Single timetable slot."""
    day: int
    time_slot: str
    start_time: str
    end_time: str
    course_name: Optional[str]
    teacher_name: Optional[str]
    room: Optional[str]


# ============== Helper Functions ==============

async def get_linked_students(db: AsyncSession, parent_user_id: UUID, tenant_id: UUID) -> List[ParentStudent]:
    """Get all students linked to a parent user."""
    result = await db.execute(
        select(ParentStudent)
        .where(and_(
            ParentStudent.parent_user_id == parent_user_id,
            ParentStudent.tenant_id == tenant_id
        ))
    )
    return result.scalars().all()


async def verify_parent_access(db: AsyncSession, parent_user_id: UUID, student_id: UUID, tenant_id: UUID) -> ParentStudent:
    """Verify that a parent has access to a specific student."""
    result = await db.execute(
        select(ParentStudent)
        .where(and_(
            ParentStudent.parent_user_id == parent_user_id,
            ParentStudent.student_id == student_id,
            ParentStudent.tenant_id == tenant_id
        ))
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this student's data"
        )
    return link


# ============== Endpoints ==============

@router.get("/children", response_model=List[ChildSummary])
async def get_my_children(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of children linked to the current parent user."""
    links = await get_linked_students(db, current_user.id, current_user.tenant_id)
    
    children = []
    for link in links:
        student = link.student
        children.append(ChildSummary(
            id=student.id,
            admission_number=student.admission_number,
            full_name=student.full_name,
            course=student.course,
            section=student.section,
            year=student.year,
            avatar_url=student.avatar_url,
            relationship_type=link.relationship_type.value
        ))
    
    return children


@router.get("/children/{student_id}/profile")
async def get_child_profile(
    student_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get full profile of a linked child."""
    link = await verify_parent_access(db, current_user.id, student_id, current_user.tenant_id)
    student = link.student
    
    return {
        "id": str(student.id),
        "admission_number": student.admission_number,
        "full_name": student.full_name,
        "date_of_birth": student.date_of_birth,
        "gender": student.gender.value if student.gender else None,
        "course": student.course,
        "department": student.department,
        "section": student.section,
        "semester": student.semester,
        "year": student.year,
        "batch": student.batch,
        "status": student.status.value if student.status else None,
        "avatar_url": student.avatar_url,
    }


@router.get("/children/{student_id}/attendance", response_model=AttendanceSummary)
async def get_child_attendance(
    student_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance summary for a linked child."""
    link = await verify_parent_access(db, current_user.id, student_id, current_user.tenant_id)
    
    if not link.can_view_attendance:
        raise HTTPException(status_code=403, detail="Attendance access not permitted")
    
    # Get attendance records
    result = await db.execute(
        select(Attendance)
        .where(and_(
            Attendance.student_id == student_id,
            Attendance.tenant_id == current_user.tenant_id
        ))
    )
    records = result.scalars().all()
    
    total = len(records)
    present = sum(1 for r in records if r.status.value == "present")
    absent = sum(1 for r in records if r.status.value == "absent")
    late = sum(1 for r in records if r.status.value == "late")
    
    return AttendanceSummary(
        total_days=total,
        present_days=present,
        absent_days=absent,
        late_days=late,
        percentage=(present / total * 100) if total > 0 else 0
    )


@router.get("/children/{student_id}/fees", response_model=FeeSummary)
async def get_child_fees(
    student_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get fee summary for a linked child."""
    link = await verify_parent_access(db, current_user.id, student_id, current_user.tenant_id)
    
    if not link.can_view_fees:
        raise HTTPException(status_code=403, detail="Fee access not permitted")
    
    # Get fee payments
    result = await db.execute(
        select(FeePayment)
        .where(and_(
            FeePayment.student_id == student_id,
            FeePayment.tenant_id == current_user.tenant_id
        ))
    )
    fees = result.scalars().all()
    
    total_fees = sum(f.total_amount for f in fees)
    paid_amount = sum(f.paid_amount for f in fees)
    pending = sum(f.total_amount - f.paid_amount for f in fees if f.status.value not in ["completed", "cancelled"])
    overdue = sum(f.total_amount - f.paid_amount for f in fees if f.status.value == "overdue")
    
    return FeeSummary(
        total_fees=total_fees,
        paid_amount=paid_amount,
        pending_amount=pending,
        overdue_amount=overdue
    )


@router.get("/children/{student_id}/grades", response_model=List[GradeSummary])
async def get_child_grades(
    student_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get exam results for a linked child."""
    link = await verify_parent_access(db, current_user.id, student_id, current_user.tenant_id)
    
    if not link.can_view_grades:
        raise HTTPException(status_code=403, detail="Grade access not permitted")
    
    # Get exam results with examination info
    result = await db.execute(
        select(ExamResult)
        .where(and_(
            ExamResult.student_id == student_id,
            ExamResult.tenant_id == current_user.tenant_id
        ))
    )
    results = result.scalars().all()
    
    grades = []
    for r in results:
        exam = r.examination
        grades.append(GradeSummary(
            exam_name=exam.name if exam else "Unknown",
            course_name=exam.course.name if exam and exam.course else None,
            marks_obtained=r.marks_obtained,
            max_marks=exam.max_marks if exam else 100,
            percentage=(r.marks_obtained / exam.max_marks * 100) if exam and exam.max_marks > 0 else 0,
            grade=r.grade,
            exam_date=exam.exam_date if exam else None
        ))
    
    return grades


@router.get("/children/{student_id}/timetable", response_model=List[TimetableSlot])
async def get_child_timetable(
    student_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get timetable for a linked child."""
    link = await verify_parent_access(db, current_user.id, student_id, current_user.tenant_id)
    
    if not link.can_view_timetable:
        raise HTTPException(status_code=403, detail="Timetable access not permitted")
    
    student = link.student
    
    # Get timetable entries for student's class/section
    result = await db.execute(
        select(TimetableEntry)
        .where(and_(
            TimetableEntry.tenant_id == current_user.tenant_id,
            TimetableEntry.status == "active"
        ))
    )
    entries = result.scalars().all()
    
    # Filter by student's class if needed
    slots = []
    for e in entries:
        time_slot = e.time_slot
        slots.append(TimetableSlot(
            day=e.day_of_week,
            time_slot=time_slot.name if time_slot else "",
            start_time=str(time_slot.start_time) if time_slot else "",
            end_time=str(time_slot.end_time) if time_slot else "",
            course_name=e.course.name if e.course else None,
            teacher_name=f"{e.teacher.first_name} {e.teacher.last_name}" if e.teacher else None,
            room=e.room.name if e.room else None
        ))
    
    return slots
