"""
Courses API Router - Course management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import date
import math
import logging

from app.config.database import get_db
from app.models.course import Course, CourseStatus
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/courses", tags=["Courses"])


# Pydantic Schemas
class CourseCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    duration_months: Optional[int] = 4
    credits: Optional[int] = 3
    max_students: Optional[int] = 50
    fee_amount: Optional[float] = 0.0
    status: Optional[str] = "active"
    instructor_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_mandatory: Optional[bool] = False
    color: Optional[str] = "#667eea"


class CourseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    duration_months: Optional[int] = None
    credits: Optional[int] = None
    max_students: Optional[int] = None
    enrolled_count: Optional[int] = None
    fee_amount: Optional[float] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    instructor_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_mandatory: Optional[bool] = None
    color: Optional[str] = None


class CourseResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    code: str
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    duration_months: Optional[int] = None
    credits: Optional[int] = None
    max_students: Optional[int] = None
    enrolled_count: Optional[int] = None
    fee_amount: Optional[float] = None
    status: str
    progress: Optional[int] = None
    instructor_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_mandatory: bool
    color: Optional[str] = None
    
    class Config:
        from_attributes = True


class CourseListResponse(BaseModel):
    items: List[CourseResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=CourseListResponse)
@require_permission("courses", "read")
async def list_courses(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    department: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all courses with pagination and filters."""
    try:
        query = select(Course).where(
            or_(Course.is_deleted == False, Course.is_deleted == None),
            Course.tenant_id == current_user.tenant_id  # Tenant isolation
        )
        
        if search:
            search_filter = f"%{search}%"
            query = query.where(
                or_(
                    Course.name.ilike(search_filter),
                    Course.code.ilike(search_filter),
                    Course.department.ilike(search_filter),
                )
            )
        
        if department:
            query = query.where(Course.department == department)
        
        if status_filter:
            query = query.where(Course.status == status_filter)
        
        # Count total with tenant filter
        count_query = select(func.count(Course.id)).where(
            or_(Course.is_deleted == False, Course.is_deleted == None),
            Course.tenant_id == current_user.tenant_id
        )
        if search:
            count_query = count_query.where(
                or_(
                    Course.name.ilike(f"%{search}%"),
                    Course.code.ilike(f"%{search}%"),
                )
            )
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Paginate
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(Course.created_at.desc())
        
        result = await db.execute(query)
        courses = result.scalars().all()
        
        return CourseListResponse(
            items=[CourseResponse(
                id=c.id,
                tenant_id=c.tenant_id,
                code=c.code,
                name=c.name,
                description=c.description,
                department=c.department,
                category=c.category,
                duration_months=c.duration_months,
                credits=c.credits,
                max_students=c.max_students,
                enrolled_count=c.enrolled_count,
                fee_amount=c.fee_amount,
                status=c.status.value if hasattr(c.status, 'value') else str(c.status),
                progress=c.progress,
                instructor_name=c.instructor_name,
                start_date=c.start_date,
                end_date=c.end_date,
                is_mandatory=c.is_mandatory or False,
                color=c.color,
            ) for c in courses],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing courses: {e}")
        raise HTTPException(status_code=500, detail="An error occurred")


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
@require_permission("courses", "create")
async def create_course(
    request: Request,
    course_data: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new course."""
    try:
        course = Course(
            code=course_data.code,
            name=course_data.name,
            description=course_data.description,
            department=course_data.department,
            category=course_data.category,
            duration_months=course_data.duration_months,
            credits=course_data.credits,
            max_students=course_data.max_students,
            fee_amount=course_data.fee_amount,
            status=CourseStatus(course_data.status) if course_data.status else CourseStatus.ACTIVE,
            instructor_name=course_data.instructor_name,
            start_date=course_data.start_date,
            end_date=course_data.end_date,
            is_mandatory=course_data.is_mandatory or False,
            color=course_data.color,
            tenant_id=current_user.tenant_id,  # Assign tenant for isolation
        )
        
        db.add(course)
        await db.commit()
        await db.refresh(course)
        
        return CourseResponse(
            id=course.id,
            tenant_id=course.tenant_id,
            code=course.code,
            name=course.name,
            description=course.description,
            department=course.department,
            category=course.category,
            duration_months=course.duration_months,
            credits=course.credits,
            max_students=course.max_students,
            enrolled_count=course.enrolled_count,
            fee_amount=course.fee_amount,
            status=course.status.value if hasattr(course.status, 'value') else str(course.status),
            progress=course.progress,
            instructor_name=course.instructor_name,
            start_date=course.start_date,
            end_date=course.end_date,
            is_mandatory=course.is_mandatory or False,
            color=course.color,
        )
    except Exception as e:
        logger.error(f"Error creating course: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{course_id}", response_model=CourseResponse)
@require_permission("courses", "read")
async def get_course(
    request: Request,
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single course by ID."""
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.tenant_id == current_user.tenant_id,  # Tenant isolation
            or_(Course.is_deleted == False, Course.is_deleted == None)
        )
    )
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return CourseResponse(
        id=course.id,
        tenant_id=course.tenant_id,
        code=course.code,
        name=course.name,
        description=course.description,
        department=course.department,
        category=course.category,
        duration_months=course.duration_months,
        credits=course.credits,
        max_students=course.max_students,
        enrolled_count=course.enrolled_count,
        fee_amount=course.fee_amount,
        status=course.status.value if hasattr(course.status, 'value') else str(course.status),
        progress=course.progress,
        instructor_name=course.instructor_name,
        start_date=course.start_date,
        end_date=course.end_date,
        is_mandatory=course.is_mandatory or False,
        color=course.color,
    )


@router.put("/{course_id}", response_model=CourseResponse)
@require_permission("courses", "update")
async def update_course(
    request: Request,
    course_id: UUID,
    course_data: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a course."""
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.tenant_id == current_user.tenant_id,  # Tenant isolation
            or_(Course.is_deleted == False, Course.is_deleted == None)
        )
    )
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Update fields
    update_data = course_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            setattr(course, field, CourseStatus(value))
        else:
            setattr(course, field, value)
    
    await db.commit()
    await db.refresh(course)
    
    return CourseResponse(
        id=course.id,
        tenant_id=course.tenant_id,
        code=course.code,
        name=course.name,
        description=course.description,
        department=course.department,
        category=course.category,
        duration_months=course.duration_months,
        credits=course.credits,
        max_students=course.max_students,
        enrolled_count=course.enrolled_count,
        fee_amount=course.fee_amount,
        status=course.status.value if hasattr(course.status, 'value') else str(course.status),
        progress=course.progress,
        instructor_name=course.instructor_name,
        start_date=course.start_date,
        end_date=course.end_date,
        is_mandatory=course.is_mandatory or False,
        color=course.color,
    )


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("courses", "delete")
async def delete_course(
    request: Request,
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a course (soft delete)."""
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.tenant_id == current_user.tenant_id,  # Tenant isolation
            or_(Course.is_deleted == False, Course.is_deleted == None)
        )
    )
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course.is_deleted = True
    await db.commit()
    return None


@router.get("/stats/departments")
@require_permission("courses", "read")
async def get_departments(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of unique departments."""
    result = await db.execute(
        select(Course.department).distinct().where(
            Course.department.isnot(None),
            Course.tenant_id == current_user.tenant_id,  # Tenant isolation
            or_(Course.is_deleted == False, Course.is_deleted == None)
        )
    )
    departments = [r[0] for r in result.fetchall() if r[0]]
    return {"departments": departments}
