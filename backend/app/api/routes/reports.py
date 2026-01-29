"""
Reports API Router - Report generation and management with advanced features
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime, date, timedelta
import math
import logging
import csv
import io

from app.config.database import get_db
from app.models import Report, ReportType, ReportFormat, ReportStatus, Tenant
from app.models import Student, Staff, FeePayment, Attendance, Message
from app.core.permissions import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Reports"])


# Pydantic Schemas
class ReportCreate(BaseModel):
    name: str
    description: Optional[str] = None
    report_type: str = "custom"
    parameters: Optional[dict] = {}
    format: Optional[str] = "json"
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ReportResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    report_type: str
    parameters: dict
    format: str
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    generated_by: Optional[UUID] = None
    generated_at: Optional[datetime] = None
    data: dict
    row_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    items: List[ReportResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ReportTypeInfo(BaseModel):
    value: str
    label: str
    description: str
    icon: str
    category: str


class QuickStatsResponse(BaseModel):
    total_students: int
    total_staff: int
    total_fee_collected: float
    total_fee_pending: float
    attendance_rate: float
    active_courses: int
    recent_admissions: int
    pending_messages: int


def get_tenant_id_from_request(request: Request) -> Optional[UUID]:
    """Get tenant_id from request state, handling both string and UUID."""
    tid = getattr(request.state, 'tenant_id', None)
    if tid is None:
        return None
    if isinstance(tid, UUID):
        return tid
    try:
        return UUID(str(tid))
    except (ValueError, TypeError):
        return None


@router.get("/quick-stats")
@require_permission("reports", "read")
async def get_quick_stats(request: Request, db: AsyncSession = Depends(get_db)):
    """Get quick statistics for the reports dashboard."""
    try:
        tenant_id = get_tenant_id_from_request(request)
        
        # Build tenant filter
        def add_tenant_filter(model, query_filter):
            if tenant_id and hasattr(model, 'tenant_id'):
                return and_(query_filter, model.tenant_id == tenant_id)
            return query_filter
        
        # Total students (with tenant filter)
        student_filter = or_(Student.is_deleted == False, Student.is_deleted == None)
        if tenant_id:
            student_filter = and_(student_filter, Student.tenant_id == tenant_id)
        students_result = await db.execute(
            select(func.count(Student.id)).where(student_filter)
        )
        total_students = students_result.scalar() or 0
        
        # Total staff (with tenant filter)
        staff_filter = or_(Staff.is_deleted == False, Staff.is_deleted == None)
        if tenant_id:
            staff_filter = and_(staff_filter, Staff.tenant_id == tenant_id)
        staff_result = await db.execute(
            select(func.count(Staff.id)).where(staff_filter)
        )
        total_staff = staff_result.scalar() or 0
        
        # Fee collection (with tenant filter)
        fee_query = select(FeePayment)
        if tenant_id:
            fee_query = fee_query.where(FeePayment.tenant_id == tenant_id)
        fees_result = await db.execute(fee_query)
        payments = fees_result.scalars().all()
        total_collected = sum(p.paid_amount for p in payments)
        total_pending = sum(p.total_amount - p.paid_amount for p in payments)
        
        # Attendance rate (mock - will be calculated properly when attendance data exists)
        attendance_rate = 85.0
        
        # Recent admissions (last 30 days) with tenant filter
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_filter = and_(
            or_(Student.is_deleted == False, Student.is_deleted == None),
            Student.created_at >= thirty_days_ago
        )
        if tenant_id:
            recent_filter = and_(recent_filter, Student.tenant_id == tenant_id)
        recent_result = await db.execute(
            select(func.count(Student.id)).where(recent_filter)
        )
        recent_admissions = recent_result.scalar() or 0
        
        # Pending messages (with tenant filter)
        msg_filter = Message.status != "read"
        if tenant_id:
            msg_filter = and_(msg_filter, Message.tenant_id == tenant_id)
        messages_result = await db.execute(
            select(func.count(Message.id)).where(msg_filter)
        )
        pending_messages = messages_result.scalar() or 0
        
        return {
            "total_students": total_students,
            "total_staff": total_staff,
            "total_fee_collected": total_collected,
            "total_fee_pending": total_pending,
            "attendance_rate": attendance_rate,
            "active_courses": 0,  # Will be implemented when courses table exists
            "recent_admissions": recent_admissions,
            "pending_messages": pending_messages,
        }
    except Exception as e:
        logger.error(f"Error getting quick stats: {e}")
        return {
            "total_students": 0,
            "total_staff": 0,
            "total_fee_collected": 0,
            "total_fee_pending": 0,
            "attendance_rate": 0,
            "active_courses": 0,
            "recent_admissions": 0,
            "pending_messages": 0,
        }


@router.get("/types", response_model=List[ReportTypeInfo])
async def get_report_types():
    """Get available report types with categories."""
    return [
        # Students Category
        {"value": "student_list", "label": "Student List", "description": "Complete list of all students with details", "icon": "school", "category": "Students"},
        {"value": "student_admission", "label": "Admission Report", "description": "New admissions by date range", "icon": "person_add", "category": "Students"},
        {"value": "student_demographics", "label": "Demographics", "description": "Student demographics breakdown", "icon": "pie_chart", "category": "Students"},
        
        # Staff Category
        {"value": "staff_list", "label": "Staff List", "description": "Complete list of all staff members", "icon": "people", "category": "Staff"},
        {"value": "staff_attendance", "label": "Staff Attendance", "description": "Staff attendance summary", "icon": "access_time", "category": "Staff"},
        
        # Finance Category
        {"value": "fee_collection", "label": "Fee Collection", "description": "Fee collection summary by period", "icon": "payments", "category": "Finance"},
        {"value": "fee_defaulters", "label": "Fee Defaulters", "description": "Students with pending/overdue fees", "icon": "warning", "category": "Finance"},
        {"value": "fee_by_type", "label": "Fee by Type", "description": "Fee breakdown by fee type", "icon": "category", "category": "Finance"},
        {"value": "daily_collection", "label": "Daily Collection", "description": "Daily fee collection report", "icon": "today", "category": "Finance"},
        
        # Attendance Category
        {"value": "attendance_summary", "label": "Attendance Summary", "description": "Overall attendance statistics", "icon": "check_circle", "category": "Attendance"},
        {"value": "absentee_report", "label": "Absentee Report", "description": "Students with low attendance", "icon": "cancel", "category": "Attendance"},
        
        # Communication Category
        {"value": "message_log", "label": "Message Log", "description": "All sent messages and notifications", "icon": "email", "category": "Communication"},
        
        # Custom
        {"value": "custom", "label": "Custom Report Builder", "description": "Select specific fields from any entity to build your own report", "icon": "build", "category": "Custom"},
    ]


# Available fields for custom report builder
AVAILABLE_FIELDS = {
    "students": {
        "label": "Students",
        "fields": [
            {"key": "admission_number", "label": "Admission Number", "type": "text"},
            {"key": "first_name", "label": "First Name", "type": "text"},
            {"key": "last_name", "label": "Last Name", "type": "text"},
            {"key": "email", "label": "Email", "type": "text"},
            {"key": "phone", "label": "Phone", "type": "text"},
            {"key": "gender", "label": "Gender", "type": "text"},
            {"key": "date_of_birth", "label": "Date of Birth", "type": "date"},
            {"key": "course", "label": "Course", "type": "text"},
            {"key": "department", "label": "Department", "type": "text"},
            {"key": "batch", "label": "Batch", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "admission_date", "label": "Admission Date", "type": "date"},
            {"key": "address", "label": "Address", "type": "text"},
            {"key": "city", "label": "City", "type": "text"},
            {"key": "parent_name", "label": "Parent Name", "type": "text"},
            {"key": "parent_phone", "label": "Parent Phone", "type": "text"},
        ]
    },
    "staff": {
        "label": "Staff",
        "fields": [
            {"key": "employee_id", "label": "Employee ID", "type": "text"},
            {"key": "first_name", "label": "First Name", "type": "text"},
            {"key": "last_name", "label": "Last Name", "type": "text"},
            {"key": "email", "label": "Email", "type": "text"},
            {"key": "phone", "label": "Phone", "type": "text"},
            {"key": "staff_type", "label": "Staff Type", "type": "text"},
            {"key": "designation", "label": "Designation", "type": "text"},
            {"key": "department", "label": "Department", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "date_of_joining", "label": "Date of Joining", "type": "date"},
            {"key": "qualification", "label": "Qualification", "type": "text"},
            {"key": "salary", "label": "Salary", "type": "number"},
        ]
    },
    "fees": {
        "label": "Fee Payments",
        "fields": [
            {"key": "transaction_id", "label": "Transaction ID", "type": "text"},
            {"key": "fee_type", "label": "Fee Type", "type": "text"},
            {"key": "total_amount", "label": "Total Amount", "type": "number"},
            {"key": "paid_amount", "label": "Paid Amount", "type": "number"},
            {"key": "balance", "label": "Balance", "type": "number"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "payment_date", "label": "Payment Date", "type": "date"},
            {"key": "payment_method", "label": "Payment Method", "type": "text"},
            {"key": "due_date", "label": "Due Date", "type": "date"},
        ]
    },
    "messages": {
        "label": "Messages",
        "fields": [
            {"key": "subject", "label": "Subject", "type": "text"},
            {"key": "recipient_name", "label": "Recipient", "type": "text"},
            {"key": "recipient_type", "label": "Type", "type": "text"},
            {"key": "priority", "label": "Priority", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "sent_at", "label": "Sent At", "type": "datetime"},
        ]
    },
}


@router.get("/available-fields")
@require_permission("reports", "read")
async def get_available_fields(request: Request):
    """Get available fields for custom report builder."""
    return AVAILABLE_FIELDS



@router.get("", response_model=ReportListResponse)
@require_permission("reports", "read")
async def list_reports(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    report_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """List all generated reports."""
    try:
        tenant_id = get_tenant_id_from_request(request)
        
        query = select(Report)
        
        # Add tenant filter
        if tenant_id:
            query = query.where(Report.tenant_id == tenant_id)
        
        if report_type:
            query = query.where(Report.report_type == report_type)
        
        if status_filter:
            query = query.where(Report.status == status_filter)
        
        # Count with tenant filter
        count_query = select(func.count(Report.id))
        if tenant_id:
            count_query = count_query.where(Report.tenant_id == tenant_id)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(Report.created_at.desc())
        
        result = await db.execute(query)
        reports = result.scalars().all()
        
        return ReportListResponse(
            items=reports,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
@require_permission("reports", "create")
async def generate_report(
    request: Request,
    report_data: ReportCreate,
    db: AsyncSession = Depends(get_db),
):
    """Generate a new report with advanced options."""
    try:
        tenant_id = get_tenant_id_from_request(request)
        
        # Create report record with tenant from request
        report = Report(
            name=report_data.name,
            description=report_data.description,
            report_type=report_data.report_type,
            parameters={
                **(report_data.parameters or {}),
                "start_date": str(report_data.start_date) if report_data.start_date else None,
                "end_date": str(report_data.end_date) if report_data.end_date else None,
            },
            format=report_data.format,
            status=ReportStatus.PROCESSING,
            tenant_id=tenant_id,
        )
        
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        # Generate report data based on type
        try:
            data = []
            row_count = 0
            
            # Helper to build base filter with tenant isolation
            def get_student_filter():
                base = or_(Student.is_deleted == False, Student.is_deleted == None)
                if tenant_id:
                    return and_(base, Student.tenant_id == tenant_id)
                return base
            
            def get_staff_filter():
                base = or_(Staff.is_deleted == False, Staff.is_deleted == None)
                if tenant_id:
                    return and_(base, Staff.tenant_id == tenant_id)
                return base
            
            if report_data.report_type == "student_list":
                result = await db.execute(
                    select(Student).where(get_student_filter())
                )
                students = result.scalars().all()
                data = [
                    {
                        "admission_number": s.admission_number,
                        "first_name": s.first_name,
                        "last_name": s.last_name,
                        "email": s.email,
                        "phone": s.phone,
                        "course": s.course,
                        "department": s.department,
                        "batch": s.batch,
                        "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
                        "admission_date": str(s.admission_date) if s.admission_date else None,
                    }
                    for s in students
                ]
                row_count = len(students)
            
            elif report_data.report_type == "student_admission":
                query = select(Student).where(get_student_filter())
                if report_data.start_date:
                    query = query.where(Student.created_at >= datetime.combine(report_data.start_date, datetime.min.time()))
                if report_data.end_date:
                    query = query.where(Student.created_at <= datetime.combine(report_data.end_date, datetime.max.time()))
                
                result = await db.execute(query.order_by(Student.created_at.desc()))
                students = result.scalars().all()
                
                # Group by month
                by_month = {}
                for s in students:
                    month_key = s.created_at.strftime("%Y-%m") if s.created_at else "Unknown"
                    if month_key not in by_month:
                        by_month[month_key] = 0
                    by_month[month_key] += 1
                
                data = {
                    "summary": {
                        "total_admissions": len(students),
                        "date_range": f"{report_data.start_date or 'All'} to {report_data.end_date or 'Present'}",
                    },
                    "by_month": [{"month": k, "count": v} for k, v in sorted(by_month.items())],
                    "records": [
                        {
                            "admission_number": s.admission_number,
                            "name": f"{s.first_name} {s.last_name}",
                            "course": s.course,
                            "admission_date": str(s.created_at.date()) if s.created_at else None,
                        }
                        for s in students[:50]
                    ]
                }
                row_count = len(students)
            
            elif report_data.report_type == "student_demographics":
                result = await db.execute(
                    select(Student).where(get_student_filter())
                )
                students = result.scalars().all()
                
                # Demographics breakdown
                by_course = {}
                by_department = {}
                by_batch = {}
                by_gender = {}
                
                for s in students:
                    course = s.course or "Unknown"
                    dept = s.department or "Unknown"
                    batch = s.batch or "Unknown"
                    gender = s.gender.value if hasattr(s, 'gender') and s.gender else "Unknown"
                    
                    by_course[course] = by_course.get(course, 0) + 1
                    by_department[dept] = by_department.get(dept, 0) + 1
                    by_batch[batch] = by_batch.get(batch, 0) + 1
                    by_gender[gender] = by_gender.get(gender, 0) + 1
                
                data = {
                    "summary": {
                        "total_students": len(students),
                        "total_courses": len(by_course),
                        "total_departments": len(by_department),
                    },
                    "by_course": [{"name": k, "count": v} for k, v in sorted(by_course.items(), key=lambda x: -x[1])],
                    "by_department": [{"name": k, "count": v} for k, v in sorted(by_department.items(), key=lambda x: -x[1])],
                    "by_batch": [{"name": k, "count": v} for k, v in sorted(by_batch.items())],
                    "by_gender": [{"name": k, "count": v} for k, v in by_gender.items()],
                }
                row_count = len(students)
                
            elif report_data.report_type == "staff_list":
                result = await db.execute(
                    select(Staff).where(get_staff_filter())
                )
                staff_list = result.scalars().all()
                data = [
                    {
                        "employee_id": s.employee_id,
                        "first_name": s.first_name,
                        "last_name": s.last_name,
                        "email": s.email,
                        "phone": s.phone,
                        "staff_type": s.staff_type.value if hasattr(s.staff_type, 'value') else str(s.staff_type),
                        "designation": s.designation,
                        "department": s.department,
                        "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
                        "join_date": str(s.date_of_joining) if hasattr(s, 'date_of_joining') and s.date_of_joining else None,
                    }
                    for s in staff_list
                ]
                row_count = len(staff_list)
                
            elif report_data.report_type == "fee_collection":
                fee_query = select(FeePayment)
                if tenant_id:
                    fee_query = fee_query.where(FeePayment.tenant_id == tenant_id)
                result = await db.execute(fee_query)
                payments = result.scalars().all()
                total_collected = sum(p.paid_amount for p in payments)
                total_pending = sum(p.total_amount - p.paid_amount for p in payments)
                paid_count = sum(1 for p in payments if str(p.status) == "paid")
                pending_count = sum(1 for p in payments if str(p.status) in ["pending", "partial"])
                
                data = {
                    "summary": {
                        "total_collected": total_collected,
                        "total_pending": total_pending,
                        "total_records": len(payments),
                        "fully_paid": paid_count,
                        "pending": pending_count,
                        "collection_rate": round(total_collected / (total_collected + total_pending) * 100, 1) if (total_collected + total_pending) > 0 else 0,
                    },
                    "records": [
                        {
                            "transaction_id": p.transaction_id,
                            "fee_type": p.fee_type.value if hasattr(p.fee_type, 'value') else str(p.fee_type),
                            "total_amount": p.total_amount,
                            "paid_amount": p.paid_amount,
                            "balance": p.total_amount - p.paid_amount,
                            "status": p.status.value if hasattr(p.status, 'value') else str(p.status),
                            "payment_date": str(p.payment_date) if p.payment_date else None,
                        }
                        for p in payments[:100]
                    ]
                }
                row_count = len(payments)
                
            elif report_data.report_type == "fee_defaulters":
                defaulter_filter = or_(
                    FeePayment.status.in_(["pending", "overdue", "partial"]),
                    FeePayment.paid_amount < FeePayment.total_amount
                )
                if tenant_id:
                    defaulter_filter = and_(defaulter_filter, FeePayment.tenant_id == tenant_id)
                result = await db.execute(
                    select(FeePayment).where(defaulter_filter)
                )
                payments = result.scalars().all()
                total_pending = sum(p.total_amount - p.paid_amount for p in payments)
                
                data = {
                    "summary": {
                        "total_defaulters": len(payments),
                        "total_pending_amount": total_pending,
                    },
                    "records": [
                        {
                            "transaction_id": p.transaction_id,
                            "student_id": str(p.student_id),
                            "fee_type": p.fee_type.value if hasattr(p.fee_type, 'value') else str(p.fee_type),
                            "total_amount": p.total_amount,
                            "paid_amount": p.paid_amount,
                            "balance": p.total_amount - p.paid_amount,
                            "status": p.status.value if hasattr(p.status, 'value') else str(p.status),
                            "due_date": str(p.due_date) if hasattr(p, 'due_date') and p.due_date else None,
                        }
                        for p in payments
                    ]
                }
                row_count = len(payments)
            
            elif report_data.report_type == "fee_by_type":
                fee_query = select(FeePayment)
                if tenant_id:
                    fee_query = fee_query.where(FeePayment.tenant_id == tenant_id)
                result = await db.execute(fee_query)
                payments = result.scalars().all()
                
                by_type = {}
                for p in payments:
                    fee_type = p.fee_type.value if hasattr(p.fee_type, 'value') else str(p.fee_type)
                    if fee_type not in by_type:
                        by_type[fee_type] = {"collected": 0, "pending": 0, "count": 0}
                    by_type[fee_type]["collected"] += p.paid_amount
                    by_type[fee_type]["pending"] += (p.total_amount - p.paid_amount)
                    by_type[fee_type]["count"] += 1
                
                data = {
                    "summary": {
                        "total_types": len(by_type),
                        "total_collected": sum(v["collected"] for v in by_type.values()),
                        "total_pending": sum(v["pending"] for v in by_type.values()),
                    },
                    "by_type": [
                        {"type": k, "collected": v["collected"], "pending": v["pending"], "count": v["count"]}
                        for k, v in sorted(by_type.items(), key=lambda x: -x[1]["collected"])
                    ]
                }
                row_count = len(payments)
                
            elif report_data.report_type == "attendance_summary":
                att_query = select(Attendance)
                if tenant_id:
                    att_query = att_query.where(Attendance.tenant_id == tenant_id)
                result = await db.execute(att_query)
                records = result.scalars().all()
                present = sum(1 for r in records if str(r.status) == "present")
                absent = sum(1 for r in records if str(r.status) == "absent")
                late = sum(1 for r in records if str(r.status) == "late")
                data = {
                    "summary": {
                        "total_records": len(records),
                        "present": present,
                        "absent": absent,
                        "late": late,
                        "attendance_percentage": round(present / len(records) * 100, 2) if records else 0,
                    }
                }
                row_count = len(records)
            
            elif report_data.report_type == "message_log":
                msg_query = select(Message).order_by(Message.created_at.desc()).limit(100)
                if tenant_id:
                    msg_query = select(Message).where(Message.tenant_id == tenant_id).order_by(Message.created_at.desc()).limit(100)
                result = await db.execute(msg_query)
                messages = result.scalars().all()
                
                data = {
                    "summary": {
                        "total_messages": len(messages),
                    },
                    "records": [
                        {
                            "subject": m.subject,
                            "recipient": m.recipient_name or m.recipient_email,
                            "type": m.recipient_type,
                            "status": m.status,
                            "sent_at": str(m.sent_at) if m.sent_at else None,
                            "priority": m.priority,
                        }
                        for m in messages
                    ]
                }
                row_count = len(messages)
            
            elif report_data.report_type == "custom":
                # Custom report builder - fetch selected fields from selected entities
                selected_fields = report_data.parameters.get("selected_fields", {})
                combined_data = []
                entities_included = []
                
                # Helper to safely get attribute value
                def safe_get(obj, key):
                    val = getattr(obj, key, None)
                    if val is None:
                        return None
                    if hasattr(val, 'value'):  # Enum
                        return val.value
                    if isinstance(val, (datetime, date)):
                        return str(val)
                    return val
                
                # Fetch students data if students fields selected
                if "students" in selected_fields and selected_fields["students"]:
                    student_fields = selected_fields["students"]
                    result = await db.execute(
                        select(Student).where(get_student_filter())
                    )
                    students = result.scalars().all()
                    entities_included.append("students")
                    
                    for s in students:
                        row = {"_entity": "student"}
                        for field in student_fields:
                            row[f"student_{field}"] = safe_get(s, field)
                        combined_data.append(row)
                
                # Fetch staff data if staff fields selected
                if "staff" in selected_fields and selected_fields["staff"]:
                    staff_fields = selected_fields["staff"]
                    result = await db.execute(
                        select(Staff).where(get_staff_filter())
                    )
                    staff_list = result.scalars().all()
                    entities_included.append("staff")
                    
                    for s in staff_list:
                        row = {"_entity": "staff"}
                        for field in staff_fields:
                            row[f"staff_{field}"] = safe_get(s, field)
                        combined_data.append(row)
                
                # Fetch fees data if fees fields selected
                if "fees" in selected_fields and selected_fields["fees"]:
                    fee_fields = selected_fields["fees"]
                    fee_query = select(FeePayment)
                    if tenant_id:
                        fee_query = fee_query.where(FeePayment.tenant_id == tenant_id)
                    result = await db.execute(fee_query)
                    payments = result.scalars().all()
                    entities_included.append("fees")
                    
                    for p in payments:
                        row = {"_entity": "fee_payment"}
                        for field in fee_fields:
                            if field == "balance":
                                row["fee_balance"] = p.total_amount - p.paid_amount
                            else:
                                row[f"fee_{field}"] = safe_get(p, field)
                        combined_data.append(row)
                
                # Fetch messages data if messages fields selected
                if "messages" in selected_fields and selected_fields["messages"]:
                    msg_fields = selected_fields["messages"]
                    msg_query = select(Message).order_by(Message.created_at.desc()).limit(100)
                    if tenant_id:
                        msg_query = select(Message).where(Message.tenant_id == tenant_id).order_by(Message.created_at.desc()).limit(100)
                    result = await db.execute(msg_query)
                    msgs = result.scalars().all()
                    entities_included.append("messages")
                    
                    for m in msgs:
                        row = {"_entity": "message"}
                        for field in msg_fields:
                            row[f"message_{field}"] = safe_get(m, field)
                        combined_data.append(row)
                
                data = {
                    "summary": {
                        "total_records": len(combined_data),
                        "entities_included": ", ".join(entities_included),
                        "fields_selected": sum(len(v) for v in selected_fields.values() if v),
                    },
                    "records": combined_data[:200]  # Limit to 200 rows
                }
                row_count = len(combined_data)
            
            # Update report with data
            report.data = {"rows": data} if isinstance(data, list) else data
            report.row_count = row_count
            report.status = ReportStatus.COMPLETED
            report.generated_at = datetime.utcnow()
            
        except Exception as gen_error:
            logger.error(f"Report generation error: {gen_error}")
            report.status = ReportStatus.FAILED
            report.error_message = str(gen_error)
        
        await db.commit()
        await db.refresh(report)
        
        return report
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{report_id}", response_model=ReportResponse)
@require_permission("reports", "read")
async def get_report(request: Request, report_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a single report by ID."""
    tenant_id = get_tenant_id_from_request(request)
    
    query = select(Report).where(Report.id == report_id)
    if tenant_id:
        query = query.where(Report.tenant_id == tenant_id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


@router.get("/{report_id}/export")
@require_permission("reports", "read")
async def export_report(request: Request, report_id: UUID, format: str = "csv", db: AsyncSession = Depends(get_db)):
    """Export a report as CSV."""
    tenant_id = get_tenant_id_from_request(request)
    
    query = select(Report).where(Report.id == report_id)
    if tenant_id:
        query = query.where(Report.tenant_id == tenant_id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.status != "completed":
        raise HTTPException(status_code=400, detail="Report is not ready for export")
    
    # Get data rows
    data = report.data
    rows = []
    
    if "rows" in data and isinstance(data["rows"], list):
        rows = data["rows"]
    elif "records" in data and isinstance(data["records"], list):
        rows = data["records"]
    
    if not rows:
        raise HTTPException(status_code=400, detail="No data to export")
    
    # Create CSV
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={report.name.replace(' ', '_')}.csv"
        }
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("reports", "delete")
async def delete_report(request: Request, report_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a report."""
    tenant_id = get_tenant_id_from_request(request)
    
    query = select(Report).where(Report.id == report_id)
    if tenant_id:
        query = query.where(Report.tenant_id == tenant_id)
    
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await db.delete(report)
    await db.commit()
    return None
