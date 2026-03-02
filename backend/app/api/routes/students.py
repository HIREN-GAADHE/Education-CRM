"""
Student API Router - CRUD operations for students
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File, Body
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, Integer, delete
from typing import Optional, List
from uuid import UUID
import math
import logging
import io

from app.config.database import get_db
from app.models import Student, StudentStatus
from app.models.fee import FeePayment
from app.models.user import User
from app.models.tenant import Tenant
from app.models.role import Role, UserRole
from app.schemas.student import (
    StudentCreate, StudentUpdate, StudentResponse, StudentListResponse,
    StudentImportResult, StudentImportError
)
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user
from app.utils.student_utils import (
    parse_csv_file, parse_excel_file, validate_student_data,
    export_students_to_csv, export_students_to_excel, create_import_template
)
from app.core.services.import_export_service import ImportExportService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=StudentListResponse)
@require_permission("students", "read")
async def list_students(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=300),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    course: Optional[str] = None,
    department: Optional[str] = None,
    class_id: Optional[UUID] = None, # Added class filter
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all students with pagination and filtering."""
    try:
        # Always filter by tenant for proper isolation
        query = select(Student).where(
            Student.is_deleted == False,
            Student.tenant_id == current_user.tenant_id  # Enforce tenant isolation
        )
        
        # Apply filters
        if search:
            search_filter = or_(
                Student.first_name.ilike(f"%{search}%"),
                Student.last_name.ilike(f"%{search}%"),
                Student.admission_number.ilike(f"%{search}%"),
                Student.email.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
        
        if status_filter:
            query = query.where(Student.status == status_filter)
        
        if course:
            query = query.where(Student.course == course)
        
        if department:
            query = query.where(Student.department == department)

        if class_id:
            query = query.where(Student.class_id == class_id)
        
        # Get total count with tenant filter
        count_query = select(func.count(Student.id)).where(
            Student.is_deleted == False,
            Student.tenant_id == current_user.tenant_id
        )
        if search:
            count_query = count_query.where(search_filter)
        if class_id:
             count_query = count_query.where(Student.class_id == class_id)
             
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(Student.created_at.desc())
        
        result = await db.execute(query)
        students = result.scalars().all()
        
        return StudentListResponse(
            items=students,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing students: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
@require_permission("students", "create")
async def create_student(
    request: Request,
    student_data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new student."""
    try:
        # Check for duplicate admission number within tenant
        existing = await db.execute(
            select(Student).where(
                Student.admission_number == student_data.admission_number,
                Student.tenant_id == current_user.tenant_id,
                Student.is_deleted == False
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student with this admission number already exists"
            )
        
        # Create student with proper tenant assignment
        student = Student(**student_data.model_dump())
        student.tenant_id = current_user.tenant_id  # Use authenticated user's tenant
        
        db.add(student)
        await db.commit()
        await db.refresh(student)
        
        return student
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating student: {e}")
        await db.rollback()
        
        # Parse database errors to provide helpful messages
        error_str = str(e).lower()
        detail = "An error occurred while creating the student"
        
        if "stringdataright" in error_str or "value too long" in error_str:
            # Extract field info from error if possible
            if "blood_group" in error_str:
                detail = "Blood group value is too long (max 10 characters)"
            elif "section" in error_str:
                detail = "Section value is too long (max 20 characters)"
            elif "phone" in error_str:
                detail = "Phone number is too long (max 20 characters)"
            elif "pincode" in error_str:
                detail = "Pincode is too long (max 20 characters)"
            elif "admission_number" in error_str:
                detail = "Admission number is too long (max 50 characters)"
            elif "roll_number" in error_str:
                detail = "Roll number is too long (max 50 characters)"
            elif "category" in error_str:
                detail = "Category value is too long (max 50 characters)"
            else:
                detail = "One or more field values are too long. Please check your input."
        elif "unique" in error_str or "duplicate" in error_str:
            detail = "A student with this information already exists"
        elif "foreign key" in error_str:
            detail = "Invalid reference to another record (class, course, etc.)"
        elif "not null" in error_str:
            detail = "A required field is missing"
        elif "invalid input" in error_str or "enum" in error_str:
            if "gender" in error_str:
                detail = "Invalid gender value. Use 'male', 'female', or 'other'"
            elif "status" in error_str:
                detail = "Invalid status value"
            else:
                detail = "Invalid value for one of the fields"
        
        raise HTTPException(status_code=400, detail=detail)


@router.get("/template")
@require_permission("students", "read")
async def download_template(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download student import template file."""
    try:
        template_content = create_import_template()
        
        return StreamingResponse(
            io.BytesIO(template_content),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': 'attachment; filename="student_import_template.xlsx"'
            }
        )
    except Exception as e:
        import traceback
        logger.error(f"Error generating template: {e}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while generating template: {str(e)}"
        )


@router.get("/export")
@require_permission("students", "read")
async def export_students(
    request: Request,
    format: str = Query("excel", regex="^(csv|excel)$"),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    course: Optional[str] = None,
    department: Optional[str] = None,
    class_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export students to CSV or Excel format."""
    try:
        # Build query with same filters as list endpoint
        query = select(Student).where(
            Student.is_deleted == False,
            Student.tenant_id == current_user.tenant_id
        )
        
        # Apply filters
        if search:
            search_filter = or_(
                Student.first_name.ilike(f"%{search}%"),
                Student.last_name.ilike(f"%{search}%"),
                Student.admission_number.ilike(f"%{search}%"),
                Student.email.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
        
        if status_filter:
            query = query.where(Student.status == status_filter)
        
        if course:
            query = query.where(Student.course == course)
        
        if department:
            query = query.where(Student.department == department)
        
        if class_id:
            query = query.where(Student.class_id == class_id)
        
        # Execute query
        result = await db.execute(query)
        students = result.scalars().all()
        
        # Convert to dict for export
        student_dicts = []
        for student in students:
            student_dict = {
                'admission_number': student.admission_number,
                'roll_number': student.roll_number,
                'first_name': student.first_name,
                'middle_name': student.middle_name,
                'last_name': student.last_name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else '',
                'gender': student.gender.value if student.gender else '',
                'blood_group': student.blood_group or '',
                'nationality': student.nationality or '',
                'religion': student.religion or '',
                'caste': student.caste or '',
                'category': student.category or '',
                'email': student.email or '',
                'phone': student.phone or '',
                'alternate_phone': student.alternate_phone or '',
                'address_line1': student.address_line1 or '',
                'address_line2': student.address_line2 or '',
                'city': student.city or '',
                'state': student.state or '',
                'pincode': student.pincode or '',
                'country': student.country or '',
                'parent_email': student.parent_email or '',
                'father_name': student.father_name or '',
                'father_phone': student.father_phone or '',
                'father_occupation': student.father_occupation or '',
                'mother_name': student.mother_name or '',
                'mother_phone': student.mother_phone or '',
                'mother_occupation': student.mother_occupation or '',
                'guardian_name': student.guardian_name or '',
                'guardian_phone': student.guardian_phone or '',
                'guardian_relation': student.guardian_relation or '',
                'course': student.course or '',
                'department': student.department or '',
                'batch': student.batch or '',
                'section': student.section or '',
                'semester': student.semester or '',
                'year': student.year or '',
                'admission_date': student.admission_date.isoformat() if student.admission_date else '',
                'admission_type': student.admission_type or '',
                'status': student.status.value if student.status else '',
                'avatar_url': student.avatar_url or '',
            }
            student_dicts.append(student_dict)
        
        # Generate file
        if format == 'csv':
            file_content = export_students_to_csv(student_dicts)
            media_type = 'text/csv'
            filename = 'students_export.csv'
        else:
            file_content = export_students_to_excel(student_dicts)
            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = 'students_export.xlsx'
        
        # Return file
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=media_type,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error exporting students: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during export"
        )


@router.get("/all")
@require_permission("students", "read")
async def list_all_students_for_dropdown(
    request: Request,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return lightweight student list for dropdowns — no pagination, all tenant students."""
    try:
        query = select(
            Student.id,
            Student.first_name,
            Student.last_name,
            Student.admission_number,
        ).where(
            Student.is_deleted == False,
            Student.tenant_id == current_user.tenant_id,
            Student.status.in_(["active", "enrolled"]),
        )
        if search:
            query = query.where(
                or_(
                    Student.first_name.ilike(f"%{search}%"),
                    Student.last_name.ilike(f"%{search}%"),
                    Student.admission_number.ilike(f"%{search}%"),
                )
            )
        query = query.order_by(Student.first_name, Student.last_name)
        result = await db.execute(query)
        rows = result.fetchall()
        return [
            {"id": str(r.id), "first_name": r.first_name, "last_name": r.last_name, "admission_number": r.admission_number}
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Error listing students for dropdown: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch students")


@router.get("/{student_id}", response_model=StudentResponse)
@require_permission("students", "read")
async def get_student(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single student by ID."""
    try:
        result = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,  # Tenant isolation
                Student.is_deleted == False
            )
        )
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        return student
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting student: {e}")
        raise HTTPException(status_code=500, detail="An error occurred")


@router.get("/{student_id}/profile")
@require_permission("students", "read")
async def get_student_profile(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive student profile with all related data."""
    from datetime import datetime, date
    from app.models.attendance import Attendance, AttendanceStatus, AttendanceType
    from app.models.examination import ExamResult, Examination, ExamStatus
    from app.models.fee import FeePayment, PaymentStatus
    from app.models.academic import SchoolClass
    
    try:
        # Get student with tenant check
        result = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,
                Student.is_deleted == False
            )
        )
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Get class info
        class_info = None
        if student.class_id:
            class_result = await db.execute(
                select(SchoolClass).where(SchoolClass.id == student.class_id)
            )
            school_class = class_result.scalar_one_or_none()
            if school_class:
                class_info = {
                    "id": str(school_class.id),
                    "name": school_class.name,
                    "section": school_class.section
                }
        
        # Calculate enrollment journey
        days_enrolled = 0
        months_enrolled = 0
        years_enrolled = 0
        if student.admission_date:
            days_enrolled = (date.today() - student.admission_date).days
            months_enrolled = days_enrolled // 30
            years_enrolled = days_enrolled // 365
        
        # Calculate expected graduation (assuming 4-year program from admission)
        expected_graduation = None
        if student.admission_date:
            from datetime import timedelta
            expected_graduation = (student.admission_date + timedelta(days=4*365)).strftime("%Y")
        
        # Academic progression milestones
        milestones = []
        if student.admission_date:
            milestones.append({
                "title": "Admission",
                "date": student.admission_date.isoformat(),
                "type": "admission",
                "icon": "school"
            })
        if student.created_at:
            milestones.append({
                "title": "Profile Created",
                "date": student.created_at.strftime("%Y-%m-%d"),
                "type": "registration",
                "icon": "person_add"
            })
        
        # Add current term/semester milestone
        current_semester = None
        if student.admission_date:
            semesters_passed = months_enrolled // 6
            current_semester = min(semesters_passed + 1, 8)  # Max 8 semesters
            if current_semester > 0:
                milestones.append({
                    "title": f"Currently in Semester {current_semester}",
                    "date": date.today().isoformat(),
                    "type": "current",
                    "icon": "timeline"
                })
        
        enrollment_journey = {
            "admission_date": student.admission_date.isoformat() if student.admission_date else None,
            "admission_type": student.admission_type,
            "current_status": student.status.value if student.status else "active",
            "days_enrolled": days_enrolled if student.admission_date else None, # Return None if not set
            "months_enrolled": months_enrolled if student.admission_date else None,
            "years_enrolled": years_enrolled if student.admission_date else None,
            "batch": student.batch,
            "expected_graduation": expected_graduation,
            "current_semester": current_semester,
            "academic_year": f"{date.today().year}-{date.today().year + 1}",
            "course": student.course,
            "department": student.department,
            "class_name": class_info["name"] if class_info else None,
            "section": class_info["section"] if class_info else None,
            "roll_number": student.roll_number,
            "milestones": milestones,
        }
        
        # Get attendance summary
        attendance_result = await db.execute(
            select(
                func.count(Attendance.id).label("total"),
                func.sum(func.cast(Attendance.status == AttendanceStatus.PRESENT, Integer)).label("present"),
                func.sum(func.cast(Attendance.status == AttendanceStatus.ABSENT, Integer)).label("absent"),
                func.sum(func.cast(Attendance.status == AttendanceStatus.LATE, Integer)).label("late"),
                func.sum(func.cast(Attendance.status == AttendanceStatus.HALF_DAY, Integer)).label("half_day"),
                func.sum(func.cast(Attendance.status == AttendanceStatus.ON_LEAVE, Integer)).label("on_leave"),
            ).where(
                Attendance.student_id == student_id,
                Attendance.tenant_id == current_user.tenant_id,
                Attendance.attendance_type == AttendanceType.STUDENT
            )
        )
        att_row = attendance_result.fetchone()
        
        total_attendance = att_row.total or 0
        present_count = att_row.present or 0
        # If total_attendance is 0, we can return 0 or None for percentage. 
        # Typically 0% is fine, but distinct 'N/A' might be better. Keeping 0 for now but ensuring robust math.
        attendance_percentage = round((present_count / total_attendance * 100), 2) if total_attendance > 0 else 0
        
        attendance_summary = {
            "total_days": total_attendance,
            "present": present_count,
            "absent": att_row.absent or 0,
            "late": att_row.late or 0,
            "half_day": att_row.half_day or 0,
            "on_leave": att_row.on_leave or 0,
            "attendance_percentage": attendance_percentage
        }
        
        # Get exam results summary
        exam_result = await db.execute(
            select(
                func.count(ExamResult.id).label("total"),
                func.sum(func.cast(ExamResult.is_passed == True, Integer)).label("passed"),
                func.avg(ExamResult.percentage).label("avg_percentage"),
                func.avg(ExamResult.grade_point).label("avg_grade_point"),
            ).where(
                ExamResult.student_id == student_id,
                ExamResult.tenant_id == current_user.tenant_id,
                ExamResult.is_absent == False
            )
        )
        exam_row = exam_result.fetchone()
        
        # Get recent exam results with exam names
        recent_results_query = await db.execute(
            select(ExamResult, Examination).join(
                Examination, ExamResult.examination_id == Examination.id
            ).where(
                ExamResult.student_id == student_id,
                ExamResult.tenant_id == current_user.tenant_id
            ).order_by(ExamResult.created_at.desc()).limit(5)
        )
        recent_results = []
        for result_row, exam in recent_results_query.fetchall():
            recent_results.append({
                "exam_name": exam.name,
                "subject": exam.subject_name,
                "marks_obtained": result_row.marks_obtained,
                "max_marks": exam.max_marks,
                "percentage": result_row.percentage,
                "grade": result_row.grade,
                "is_passed": result_row.is_passed,
                "rank": result_row.rank,
                "exam_date": exam.exam_date.isoformat() if exam.exam_date else None
            })
        
        exam_summary = {
            "exams_taken": exam_row.total or 0,
            "exams_passed": exam_row.passed or 0,
            "average_percentage": round(exam_row.avg_percentage or 0, 2),
            "average_grade_point": round(exam_row.avg_grade_point or 0, 2),
            "recent_results": recent_results
        }
        
        # Get fee summary
        fee_result = await db.execute(
            select(
                func.sum(FeePayment.total_amount).label("total_fees"),
                func.sum(FeePayment.paid_amount).label("paid"),
            ).where(
                FeePayment.student_id == student_id,
                FeePayment.tenant_id == current_user.tenant_id
            )
        )
        fee_row = fee_result.fetchone()
        
        total_fees = float(fee_row.total_fees or 0)
        paid_amount = float(fee_row.paid or 0)
        
        # Get recent payments
        recent_payments_result = await db.execute(
            select(FeePayment).where(
                FeePayment.student_id == student_id,
                FeePayment.tenant_id == current_user.tenant_id
            ).order_by(FeePayment.created_at.desc()).limit(5)
        )
        recent_payments = []
        for payment in recent_payments_result.scalars().all():
            recent_payments.append({
                "id": str(payment.id),
                "fee_type": payment.fee_type,
                "total_amount": float(payment.total_amount),
                "amount_paid": float(payment.paid_amount),
                "due_date": payment.due_date.isoformat() if payment.due_date else None,
                "status": payment.status.value if payment.status else "pending"
            })
        
        # Calculate payment percentage
        # usage: None indicates 'No Fees Assigned' to distinguish from '0% Paid'
        payment_percentage = None
        if total_fees > 0:
            payment_percentage = round((paid_amount / total_fees * 100), 2)
        
        fee_summary = {
            "total_fees": total_fees,
            "paid": paid_amount,
            "pending": total_fees - paid_amount,
            "payment_percentage": payment_percentage, 
            "recent_payments": recent_payments
        }
        
        # Academic progress
        academic_progress = {
            "current_year": student.year,
            "current_semester": student.semester,
            "course": student.course,
            "department": student.department,
            "cgpa": exam_summary["average_grade_point"],
            "class": class_info
        }
        
        # Build full response
        student_data = {
            "id": str(student.id),
            "admission_number": student.admission_number,
            "roll_number": student.roll_number,
            "first_name": student.first_name,
            "middle_name": student.middle_name,
            "last_name": student.last_name,
            "full_name": student.full_name,
            "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
            "gender": student.gender.value if student.gender else None,
            "blood_group": student.blood_group,
            "email": student.email,
            "phone": student.phone,
            "alternate_phone": student.alternate_phone,
            "nationality": student.nationality,
            "category": student.category,
            "address_line1": student.address_line1,
            "address_line2": student.address_line2,
            "city": student.city,
            "state": student.state,
            "pincode": student.pincode,
            "country": student.country,
            "avatar_url": student.avatar_url,
            "father_name": student.father_name,
            "father_phone": student.father_phone,
            "father_occupation": student.father_occupation,
            "mother_name": student.mother_name,
            "mother_phone": student.mother_phone,
            "mother_occupation": student.mother_occupation,
            "guardian_name": student.guardian_name,
            "guardian_phone": student.guardian_phone,
            "guardian_relation": student.guardian_relation,
            "parent_email": student.parent_email,
            "status": student.status.value if student.status else "active",
            "created_at": student.created_at.isoformat(),
        }
        
        return {
            "student": student_data,
            "enrollment_journey": enrollment_journey,
            "attendance_summary": attendance_summary,
            "exam_summary": exam_summary,
            "fee_summary": fee_summary,
            "academic_progress": academic_progress
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting student profile: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.put("/{student_id}", response_model=StudentResponse)
@require_permission("students", "update")
async def update_student(
    request: Request,
    student_id: UUID,
    student_data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a student."""
    try:
        result = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,  # Tenant isolation
                Student.is_deleted == False
            )
        )
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Update fields
        update_data = student_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(student, field, value)
        
        await db.commit()
        await db.refresh(student)
        
        return student
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating student: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while updating")


@router.delete("/bulk", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("students", "delete")
async def bulk_delete_students(
    request: Request,
    student_ids: List[UUID] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete multiple students.
    Only allowed for University Admins and Super Admins.
    """
    from datetime import datetime
    from app.models.role import RoleLevel
    from app.models.student import Student
    from sqlalchemy import update

    # Verify Role Level (Must be University Admin or Super Admin)
    # We assume current_user.roles is available/loaded. 
    # If using lazy loading, we might need to explicit join, but let's try assuming it's accessible or use a query.
    
    # Check permissions using DB query to be safe with Async
    user_roles_query = await db.execute(
        select(Role.level).join(UserRole).where(UserRole.user_id == current_user.id)
    )
    role_levels = user_roles_query.scalars().all()
    
    is_authorized = any(level <= RoleLevel.UNIVERSITY_ADMIN.value for level in role_levels)
    
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bulk delete is restricted to University Administrators only."
        )

    try:
        # Perform bulk HARD delete
        # 1. Delete related FeePayments first to avoid FK constraints
        # (Assuming no other strict FKs block this, or we should add them here)
        await db.execute(
            delete(FeePayment).where(
                FeePayment.student_id.in_(student_ids),
                FeePayment.tenant_id == current_user.tenant_id
            )
        )
        
        # 2. Delete Students
        stmt = delete(Student).where(
            Student.id.in_(student_ids),
            Student.tenant_id == current_user.tenant_id,
        )
        
        result = await db.execute(stmt)
        await db.commit()
        
        if result.rowcount == 0:
            pass
            
        return None
        
    except Exception as e:
        logger.error(f"Error bulk deleting students: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while deleting students")


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("students", "delete")
async def delete_student(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a student."""
    from datetime import datetime
    try:
        result = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,  # Tenant isolation
                Student.is_deleted == False
            )
        )
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Soft delete
        student.is_deleted = True
        student.deleted_at = datetime.utcnow()
        student.deleted_by = current_user.id
        
        await db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting student: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while deleting")


@router.post("/import", response_model=StudentImportResult)
@require_permission("students", "create")
async def import_students(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import students from CSV or Excel file."""
    try:
        # Validate file type
        filename = file.filename.lower()
        if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format. Only CSV and Excel (.xlsx, .xls) files are supported."
            )
        
        # Read content
        content = await file.read()
        
        # Extract options from form data
        form = await request.form()
        update_existing = str(form.get("update_existing", "false")).lower() == "true"
        skip_duplicates = str(form.get("skip_duplicates", "true")).lower() == "true"
        
        # Use ImportExportService
        service = ImportExportService(db)
        
        if filename.endswith('.csv'):
            results = await service.import_students_from_csv(
                str(current_user.tenant_id), content, skip_duplicates, update_existing
            )
        else:
            results = await service.import_students_from_excel(
                str(current_user.tenant_id), content, skip_duplicates, update_existing
            )
            
        # Map results to response schema
        response_errors = []
        for err in results.get("errors", []):
            response_errors.append(StudentImportError(
                row=err.get("row", 0),
                message=err.get("error", "Unknown error")
            ))
            
        return StudentImportResult(
            total_rows=results.get("total_rows", 0),
            successful=results.get("imported", 0) + results.get("updated", 0),
            failed=len(results.get("errors", [])),
            imported=results.get("imported", 0),
            updated=results.get("updated", 0),
            fees_created=results.get("fees_created", 0),
            errors=response_errors,
            imported_ids=results.get("imported_ids", [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during import: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="An error occurred during import"
        )


@router.get("/{student_id}/id-card")
@require_permission("students", "read")
async def download_id_card(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download student ID card as PDF."""
    from app.utils.pdf_utils import generate_id_card_pdf
    from app.utils.pdf_utils import generate_id_card_pdf
    from app.models.academic import SchoolClass
    from app.models.tenant import Tenant
    
    try:
        # Get student
        result = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,
                Student.is_deleted == False
            )
        )
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Get class info
        class_info = None
        if student.class_id:
            class_result = await db.execute(
                select(SchoolClass).where(SchoolClass.id == student.class_id)
            )
            school_class = class_result.scalar_one_or_none()
            if school_class:
                class_info = {
                    "name": school_class.name,
                    "section": school_class.section
                }
        
        # Get tenant info from database
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == current_user.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        tenant_info = {
            "name": tenant.name if tenant else "Educational Institution",
            "address": getattr(tenant, "address", "") if tenant else ""
        }
        
        # Generate PDF
        student_data = {
            "id": str(student.id),
            "first_name": student.first_name,
            "last_name": student.last_name,
            "admission_number": student.admission_number,
            "course": student.course,
            "blood_group": student.blood_group,
            "phone": student.phone,
        }
        
        pdf_buffer = generate_id_card_pdf(student_data, tenant_info, class_info)
        
        filename = f"id_card_{student.admission_number}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating ID card: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate ID card")


@router.get("/{student_id}/transcript")
@require_permission("students", "read")
async def download_transcript(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download student academic transcript as PDF."""
    from app.utils.pdf_utils import generate_transcript_pdf
    from app.utils.pdf_utils import generate_transcript_pdf
    from app.models.examination import ExamResult
    from app.models.tenant import Tenant
    
    try:
        # Get student
        result = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,
                Student.is_deleted == False
            )
        )
        student = result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Get exam results
        exams_result = await db.execute(
            select(ExamResult).where(
                ExamResult.student_id == student_id,
                ExamResult.tenant_id == current_user.tenant_id
            ).order_by(ExamResult.created_at.desc())
        )
        exam_records = exams_result.scalars().all()
        
        exams = []
        for exam in exam_records:
            exams.append({
                "exam_name": exam.exam_name if hasattr(exam, 'exam_name') else "Exam",
                "subject": exam.subject if hasattr(exam, 'subject') else "Subject",
                "max_marks": exam.max_marks if hasattr(exam, 'max_marks') else 100,
                "marks_obtained": exam.marks_obtained if hasattr(exam, 'marks_obtained') else 0,
                "grade": exam.grade if hasattr(exam, 'grade') else "-",
                "is_passed": exam.is_passed if hasattr(exam, 'is_passed') else True,
                "passing_marks": exam.passing_marks if hasattr(exam, 'passing_marks') else 35
            })
        
        # Get tenant info from database
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == current_user.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        tenant_info = {
            "name": tenant.name if tenant else "Educational Institution"
        }
        
        # Student data
        student_data = {
            "first_name": student.first_name,
            "middle_name": student.middle_name or "",
            "last_name": student.last_name,
            "admission_number": student.admission_number,
            "course": student.course,
            "department": student.department,
            "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else "N/A"
        }
        
        # Academic info (calculate from exams if available)
        academic_info = None
        if exams:
            total_marks = sum(e.get("marks_obtained", 0) for e in exams)
            max_marks = sum(e.get("max_marks", 100) for e in exams)
            if max_marks > 0:
                percentage = (total_marks / max_marks) * 100
                # Simple CGPA approximation (percentage / 10)
                academic_info = {
                    "cgpa": round(percentage / 10, 2),
                    "total_credits": len(exams) * 3  # Approximate
                }
        
        pdf_buffer = generate_transcript_pdf(student_data, exams, tenant_info, academic_info)
        
        filename = f"transcript_{student.admission_number}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating transcript: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate transcript")

