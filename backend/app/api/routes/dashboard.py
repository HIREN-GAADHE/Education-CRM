"""
Dashboard API Routes
Provides real-time statistics and data for the dashboard with tenant isolation
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, date, time
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.config.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.staff import Staff
from app.models.fee import FeePayment
from app.models.message import Message
from app.models.attendance import Attendance, AttendanceStatus
from app.models.timetable import TimetableEntry, TimeSlot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    total_students: int
    total_staff: int
    active_courses: int
    fee_collection: float
    students_change: Optional[str] = None
    staff_change: Optional[str] = None
    courses_change: Optional[str] = None
    fee_change: Optional[str] = None


class DepartmentAttendance(BaseModel):
    label: str
    value: int
    color: str


class ScheduleEvent(BaseModel):
    time: str
    event: str
    type: str = "class"
    color: str = "#4f46e5"


class Notification(BaseModel):
    title: str
    time: str
    type: str


class DashboardResponse(BaseModel):
    stats: DashboardStats
    attendance: List[DepartmentAttendance]
    schedule: List[ScheduleEvent]
    notifications: List[Notification]
    recent_students: List[dict]
    recent_payments: List[dict]


@router.get("", response_model=DashboardResponse)
async def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all dashboard data including stats, attendance, schedule, and notifications."""
    
    tenant_id = current_user.tenant_id
    total_students = 0
    total_staff = 0
    active_courses = 0
    fee_collection = 0.0
    recent_students = []
    recent_payments = []
    notifications = []
    attendance = []
    schedule = []
    
    # Get total students count
    try:
        result = await db.execute(
            select(func.count(Student.id)).where(
                and_(
                    Student.tenant_id == tenant_id,
                    or_(Student.is_deleted == False, Student.is_deleted == None)
                )
            )
        )
        total_students = result.scalar() or 0
    except Exception as e:
        logger.error(f"Error counting students: {e}")
    
    # Get total staff count
    try:
        result = await db.execute(
            select(func.count(Staff.id)).where(
                and_(
                    Staff.tenant_id == tenant_id,
                    or_(Staff.is_deleted == False, Staff.is_deleted == None)
                )
            )
        )
        total_staff = result.scalar() or 0
    except Exception as e:
        logger.error(f"Error counting staff: {e}")
    
    # Get courses count
    try:
        # Check if course table exists and count
        from app.models.academic import Course
        result = await db.execute(
            select(func.count(Course.id)).where(
                and_(
                    Course.tenant_id == tenant_id,
                    or_(Course.is_deleted == False, Course.is_deleted == None)
                )
            )
        )
        active_courses = result.scalar() or 0
    except ImportError:
         # Fallback if model not imported properly or using query
        try:
             from sqlalchemy import text
             result = await db.execute(
                 text("SELECT COUNT(*) FROM courses WHERE tenant_id = :tid AND (is_deleted = false OR is_deleted IS NULL)"),
                 {"tid": tenant_id}
             )
             active_courses = result.scalar() or 0
        except Exception:
             active_courses = 0
    except Exception as e:
        logger.warning(f"Error counting courses: {e}")
        active_courses = 0
    
    # Get fee collection this month
    try:
        current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = await db.execute(
            select(func.coalesce(func.sum(FeePayment.amount_paid), 0)).where(
                and_(
                    FeePayment.tenant_id == tenant_id,
                    FeePayment.status == 'paid',
                    FeePayment.payment_date >= current_month_start
                )
            )
        )
        fee_collection = float(result.scalar() or 0)
    except Exception as e:
        logger.warning(f"Error getting fee collection: {e}")
    
    # Get recent students (last 5)
    try:
        result = await db.execute(
            select(Student)
            .where(
                and_(
                    Student.tenant_id == tenant_id,
                    or_(Student.is_deleted == False, Student.is_deleted == None)
                )
            )
            .order_by(Student.created_at.desc())
            .limit(5)
        )
        students = result.scalars().all()
        recent_students = [
            {
                "id": str(s.id),
                "name": f"{s.first_name} {s.last_name}",
                "admission_number": s.admission_number or "N/A",
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in students
        ]
    except Exception as e:
        logger.error(f"Error fetching recent students: {e}")
    
    # Get recent payments
    try:
        result = await db.execute(
            select(FeePayment)
            .options(selectinload(FeePayment.student))
            .where(
                and_(
                    FeePayment.tenant_id == tenant_id,
                    FeePayment.status == 'paid'
                )
            )
            .order_by(FeePayment.payment_date.desc())
            .limit(5)
        )
        payments = result.scalars().all()
        recent_payments = [
            {
                "id": str(p.id),
                "amount": float(p.amount_paid or 0),
                "date": p.payment_date.isoformat() if p.payment_date else None,
                "student_name": f"{p.student.first_name} {p.student.last_name}" if p.student else "Unknown",
            }
            for p in payments
        ]
    except Exception as e:
        logger.warning(f"Error fetching recent payments: {e}")
    
    # Get notifications (Messages)
    try:
        result = await db.execute(
            select(Message)
            .where(
                and_(
                    Message.tenant_id == tenant_id,
                    or_(Message.is_deleted == False, Message.is_deleted == None)
                )
            )
            .order_by(Message.created_at.desc())
            .limit(4)
        )
        messages = result.scalars().all()
        
        for msg in messages:
            time_diff = datetime.utcnow() - msg.created_at if msg.created_at else timedelta(0)
            if time_diff.days > 0:
                time_str = f"{time_diff.days} days ago"
            elif time_diff.seconds > 3600:
                time_str = f"{time_diff.seconds // 3600} hours ago"
            elif time_diff.seconds > 60:
                time_str = f"{time_diff.seconds // 60} mins ago"
            else:
                time_str = "just now"
            
            notifications.append(Notification(
                title=msg.subject[:50] + ('...' if len(msg.subject) > 50 else ''),
                time=time_str,
                type="info"
            ))
    except Exception as e:
        logger.warning(f"Error fetching notifications: {e}")
    
    # REAL Attendance Data
    try:
        # Aggregate attendance by pseudo-departments (using course or section as proxy) or just status
        # Since 'Department' model isn't strictly defined in context, let's group by 'course' or show 'Present/Absent' ratio
        
        # Method 1: Present vs Absent count for today
        today = date.today()
        result = await db.execute(
            select(Attendance.status, func.count(Attendance.id))
            .where(
                and_(
                    Attendance.tenant_id == tenant_id,
                    Attendance.attendance_date == today
                )
            )
            .group_by(Attendance.status)
        )
        attendance_counts = dict(result.all())
        # attendance_counts = {AttendanceStatus.PRESENT: 50, AttendanceStatus.ABSENT: 2}
        
        # If no data for today, maybe show an empty chart or dummy " No Data"
        # Ideally, we want "Department" data. If 'course' is populated in Attendance, use that.
        
        course_result = await db.execute(
             select(Attendance.course, func.count(Attendance.id))
             .where(
                 and_(
                     Attendance.tenant_id == tenant_id,
                     Attendance.attendance_date == today,
                     Attendance.status == AttendanceStatus.PRESENT
                 )
             )
             .group_by(Attendance.course)
             .limit(5)
        )
        course_attendance = course_result.all()
        
        colors = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626"]
        
        if course_attendance:
             for i, (course_name, count) in enumerate(course_attendance):
                 if course_name: # Filter None
                     attendance.append(DepartmentAttendance(
                         label=str(course_name),
                         value=count,
                         color=colors[i % len(colors)]
                     ))
        else:
             # Fallback: if no attendance marked today, show 0 or previous day?
             # Let's show empty list -> Frontend should handle empty state or we send 0
             pass

    except Exception as e:
        logger.error(f"Error fetching attendance: {e}")

    # REAL Schedule Data (Timetable)
    try:
        # Get timetable events for TODAY
        # Day of week: Mon=1, Sun=7. Python weekday(): Mon=0, Sun=6.
        # DB DayOfWeek Enum: Mon=1...
        
        today_weekday = datetime.today().weekday() + 1 # 1-7
        
        result = await db.execute(
             select(TimetableEntry)
             .options(selectinload(TimetableEntry.time_slot))
             .join(TimetableEntry.time_slot)
             .where(
                 and_(
                     TimetableEntry.tenant_id == tenant_id,
                     TimetableEntry.day_of_week == today_weekday,
                     TimetableEntry.status == 'ACTIVE' # Use string if Enum issues
                 )
             )
             .order_by(TimeSlot.start_time)
             .limit(5)
        )
        entries = result.scalars().all()
        
        type_colors = {
            "class": "#0891b2",
            "break": "#6b7280",
            "assembly": "#d97706",
            "exam": "#dc2626",
            "free": "#10b981",
        }
        
        for entry in entries:
            # Format time
            time_str = entry.time_slot.start_time.strftime("%I:%M %p")
            event_name = entry.subject_name or (entry.course.name if entry.course else "Activity")
            slot_type = entry.time_slot.slot_type.value if hasattr(entry.time_slot.slot_type, 'value') else str(entry.time_slot.slot_type)
            
            schedule.append(ScheduleEvent(
                time=time_str,
                event=f"{event_name} ({entry.class_name or ''})",
                type=slot_type,
                color=type_colors.get(slot_type, "#4f46e5")
            ))
            
    except Exception as e:
        logger.error(f"Error fetching schedule: {e}")

    
    # Build stats
    stats = DashboardStats(
        total_students=total_students,
        total_staff=total_staff,
        active_courses=active_courses,
        fee_collection=fee_collection,
        students_change=f"+{total_students}" if total_students > 0 else None,
        staff_change=f"+{total_staff}" if total_staff > 0 else None,
        courses_change=f"{active_courses} active" if active_courses > 0 else "0 courses",
        fee_change=f"₹{fee_collection:,.0f}" if fee_collection > 0 else None,
    )
    
    return DashboardResponse(
        stats=stats,
        attendance=attendance,
        schedule=schedule,
        notifications=notifications,
        recent_students=recent_students,
        recent_payments=recent_payments,
    )


@router.get("/stats")
async def get_quick_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get quick stats only (for header or widgets)."""
    tenant_id = current_user.tenant_id
    try:
        # Students
        students_result = await db.execute(
            select(func.count(Student.id)).where(
                and_(
                    Student.tenant_id == tenant_id,
                    or_(Student.is_deleted == False, Student.is_deleted == None)
                )
            )
        )
        students = students_result.scalar() or 0
        
        # Staff
        staff_result = await db.execute(
            select(func.count(Staff.id)).where(
                and_(
                    Staff.tenant_id == tenant_id,
                    or_(Staff.is_deleted == False, Staff.is_deleted == None)
                )
            )
        )
        staff = staff_result.scalar() or 0
        
        return {
            "students": students,
            "staff": staff,
            "courses": 0,
        }
    except Exception as e:
        logger.error(f"Error fetching quick stats: {e}")
        return {"students": 0, "staff": 0, "courses": 0}
