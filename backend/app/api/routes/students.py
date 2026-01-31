"""
Student API Router - CRUD operations for students
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List
from uuid import UUID
import math
import logging
import io

from app.config.database import get_db
from app.models import Student, StudentStatus
from app.models.user import User
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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=StudentListResponse)
@require_permission("students", "read")
async def list_students(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
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
        
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if filename.endswith('.csv'):
            records, parse_errors = parse_csv_file(content)
        else:
            records, parse_errors = parse_excel_file(content)
        
        # Initialize result tracking
        result = StudentImportResult(
            total_rows=len(records) + len(parse_errors),
            successful=0,
            failed=len(parse_errors),
            errors=[StudentImportError(row=0, message=err) for err in parse_errors],
            imported_ids=[]
        )
        
        # Process each record
        for idx, record in enumerate(records, start=1):
            try:
                # Validate data
                validation_errors = validate_student_data(record)
                if validation_errors:
                    result.failed += 1
                    for error in validation_errors:
                        result.errors.append(StudentImportError(
                            row=idx,
                            field=None,
                            message=error
                        ))
                    continue
                
                # Check for duplicate admission number within tenant
                admission_number = record.get('admission_number')
                existing = await db.execute(
                    select(Student).where(
                        Student.admission_number == admission_number,
                        Student.tenant_id == current_user.tenant_id,
                        Student.is_deleted == False
                    )
                )
                if existing.scalar_one_or_none():
                    result.failed += 1
                    result.errors.append(StudentImportError(
                        row=idx,
                        field='admission_number',
                        message=f"Student with admission number '{admission_number}' already exists"
                    ))
                    continue
                
                # Create student
                student_data = StudentCreate(**record)
                student = Student(**student_data.model_dump())
                student.tenant_id = current_user.tenant_id
                
                db.add(student)
                await db.flush()  # Flush to get ID without committing
                
                result.successful += 1
                result.imported_ids.append(student.id)
                
            except Exception as e:
                result.failed += 1
                result.errors.append(StudentImportError(
                    row=idx,
                    message=f"Error importing student: {str(e)}"
                ))
                logger.error(f"Error importing student at row {idx}: {e}")
        
        # Commit all successful imports
        if result.successful > 0:
            await db.commit()
        else:
            await db.rollback()
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during import: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="An error occurred during import"
        )
