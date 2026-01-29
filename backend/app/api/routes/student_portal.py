"""
Student Portal API Routes
Self-service portal for students to view their academic data and pay fees.
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
    User, Student, Attendance, FeePayment, TimetableEntry,
    ExamResult
)


router = APIRouter(prefix="/student", tags=["Student Portal"])


# ============== Schemas ==============

class StudentProfile(BaseModel):
    """Student profile information."""
    id: UUID
    admission_number: str
    roll_number: Optional[str]
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    date_of_birth: Optional[date]
    course: Optional[str]
    department: Optional[str]
    section: Optional[str]
    semester: Optional[int]
    year: Optional[int]
    batch: Optional[str]
    status: str
    avatar_url: Optional[str]
    
    class Config:
        from_attributes = True


class AttendanceRecord(BaseModel):
    """Single attendance record."""
    date: date
    status: str
    course_name: Optional[str]
    remarks: Optional[str]


class FeeRecord(BaseModel):
    """Fee payment record."""
    id: UUID
    fee_type: str
    total_amount: float
    paid_amount: float
    discount_amount: float
    balance: float
    due_date: Optional[date]
    status: str
    receipt_number: Optional[str]


class ExamGrade(BaseModel):
    """Exam result with grade."""
    exam_id: UUID
    exam_name: str
    exam_type: str
    course_name: Optional[str]
    exam_date: Optional[date]
    marks_obtained: float
    max_marks: float
    percentage: float
    grade: Optional[str]





class DashboardData(BaseModel):
    """Student dashboard summary."""
    profile_name: str
    admission_number: str
    attendance_percentage: float
    pending_fees: float
    recent_grades: List[ExamGrade]
    upcoming_exams: int


# ============== Helper Functions ==============

async def get_student_record(db: AsyncSession, user_id: UUID, tenant_id: UUID) -> Student:
    """Get the student record linked to a user account."""
    result = await db.execute(
        select(Student)
        .where(and_(
            Student.user_id == user_id,
            Student.tenant_id == tenant_id
        ))
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student record linked to this account"
        )
    return student


# ============== Endpoints ==============

@router.get("/dashboard", response_model=DashboardData)
async def get_student_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get student dashboard with summary data."""
    student = await get_student_record(db, current_user.id, current_user.tenant_id)
    
    # Get attendance
    att_result = await db.execute(
        select(Attendance).where(and_(
            Attendance.student_id == student.id,
            Attendance.tenant_id == current_user.tenant_id
        ))
    )
    attendance_records = att_result.scalars().all()
    total_att = len(attendance_records)
    present = sum(1 for a in attendance_records if a.status.value == "present")
    att_percent = (present / total_att * 100) if total_att > 0 else 0
    
    # Get pending fees
    fee_result = await db.execute(
        select(FeePayment).where(and_(
            FeePayment.student_id == student.id,
            FeePayment.tenant_id == current_user.tenant_id,
            FeePayment.status.in_(["pending", "partial", "overdue"])
        ))
    )
    fees = fee_result.scalars().all()
    pending_fees = sum((f.total_amount - f.paid_amount) for f in fees)
    
    # Get recent grades
    grade_result = await db.execute(
        select(ExamResult).where(and_(
            ExamResult.student_id == student.id,
            ExamResult.tenant_id == current_user.tenant_id
        )).order_by(ExamResult.created_at.desc()).limit(5)
    )
    results = grade_result.scalars().all()
    recent_grades = []
    for r in results:
        exam = r.examination
        if exam:
            recent_grades.append(ExamGrade(
                exam_id=exam.id,
                exam_name=exam.name,
                exam_type=exam.exam_type.value if exam.exam_type else "other",
                course_name=exam.course.name if exam.course else None,
                exam_date=exam.exam_date,
                marks_obtained=r.marks_obtained,
                max_marks=exam.max_marks,
                percentage=(r.marks_obtained / exam.max_marks * 100) if exam.max_marks > 0 else 0,
                grade=r.grade
            ))
    
    return DashboardData(
        profile_name=student.full_name,
        admission_number=student.admission_number,
        attendance_percentage=round(att_percent, 2),
        pending_fees=pending_fees,
        recent_grades=recent_grades,
        upcoming_exams=0  # Would need exam scheduling to compute
    )


@router.get("/profile", response_model=StudentProfile)
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get own student profile."""
    student = await get_student_record(db, current_user.id, current_user.tenant_id)
    
    return StudentProfile(
        id=student.id,
        admission_number=student.admission_number,
        roll_number=student.roll_number,
        full_name=student.full_name,
        email=student.email,
        phone=student.phone,
        date_of_birth=student.date_of_birth,
        course=student.course,
        department=student.department,
        section=student.section,
        semester=student.semester,
        year=student.year,
        batch=student.batch,
        status=student.status.value if student.status else "active",
        avatar_url=student.avatar_url
    )


@router.get("/attendance", response_model=List[AttendanceRecord])
async def get_my_attendance(
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get own attendance records."""
    student = await get_student_record(db, current_user.id, current_user.tenant_id)
    
    result = await db.execute(
        select(Attendance)
        .where(and_(
            Attendance.student_id == student.id,
            Attendance.tenant_id == current_user.tenant_id
        ))
        .order_by(Attendance.date.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    
    return [
        AttendanceRecord(
            date=r.date,
            status=r.status.value if r.status else "unknown",
            course_name=r.course.name if hasattr(r, 'course') and r.course else None,
            remarks=r.remarks
        )
        for r in records
    ]


@router.get("/fees", response_model=List[FeeRecord])
async def get_my_fees(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get own fee records."""
    student = await get_student_record(db, current_user.id, current_user.tenant_id)
    
    result = await db.execute(
        select(FeePayment)
        .where(and_(
            FeePayment.student_id == student.id,
            FeePayment.tenant_id == current_user.tenant_id
        ))
        .order_by(FeePayment.created_at.desc())
    )
    fees = result.scalars().all()
    
    return [
        FeeRecord(
            id=f.id,
            fee_type=f.fee_type.value if f.fee_type else "other",
            total_amount=f.total_amount,
            paid_amount=f.paid_amount,
            discount_amount=f.discount_amount,
            balance=f.total_amount - f.paid_amount - f.discount_amount,
            due_date=f.due_date,
            status=f.status.value if f.status else "pending",
            receipt_number=f.receipt_number
        )
        for f in fees
    ]


@router.get("/grades", response_model=List[ExamGrade])
async def get_my_grades(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get own exam results."""
    student = await get_student_record(db, current_user.id, current_user.tenant_id)
    
    result = await db.execute(
        select(ExamResult)
        .where(and_(
            ExamResult.student_id == student.id,
            ExamResult.tenant_id == current_user.tenant_id
        ))
        .order_by(ExamResult.created_at.desc())
    )
    results = result.scalars().all()
    
    grades = []
    for r in results:
        exam = r.examination
        if exam:
            grades.append(ExamGrade(
                exam_id=exam.id,
                exam_name=exam.name,
                exam_type=exam.exam_type.value if exam.exam_type else "other",
                course_name=exam.course.name if exam.course else None,
                exam_date=exam.exam_date,
                marks_obtained=r.marks_obtained,
                max_marks=exam.max_marks,
                percentage=(r.marks_obtained / exam.max_marks * 100) if exam.max_marks > 0 else 0,
                grade=r.grade
            ))
    
    return grades





@router.get("/timetable")
async def get_my_timetable(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get own class timetable."""
    student = await get_student_record(db, current_user.id, current_user.tenant_id)
    
    # Get timetable entries (would need to filter by class/section)
    result = await db.execute(
        select(TimetableEntry)
        .where(and_(
            TimetableEntry.tenant_id == current_user.tenant_id,
            TimetableEntry.status == "active"
        ))
    )
    entries = result.scalars().all()
    
    timetable = []
    for e in entries:
        time_slot = e.time_slot
        timetable.append({
            "day": e.day_of_week,
            "time_slot": time_slot.name if time_slot else "",
            "start_time": str(time_slot.start_time) if time_slot else "",
            "end_time": str(time_slot.end_time) if time_slot else "",
            "course": e.course.name if e.course else None,
            "teacher": f"{e.teacher.first_name} {e.teacher.last_name}" if e.teacher else None,
            "room": e.room.name if e.room else None
        })
    
    return timetable
