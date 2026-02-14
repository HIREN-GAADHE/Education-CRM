"""
Examination API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from app.config.database import get_db
from app.core.middleware.auth import get_current_user
from app.models.user import User
from app.models.examination import (
    Examination,
    ExamResult,
    GradeScale,
    ExamType,
    ExamStatus,
)
from app.schemas.examination import (
    GradeScaleCreate,
    GradeScaleResponse,
    GradeScaleDetailResponse,
    ExaminationCreate,
    ExaminationUpdate,
    ExaminationResponse,
    ExaminationListResponse,
    ExamResultCreate,
    BulkExamResultCreate,
    ExamResultResponse,
    ExamResultDetailResponse,
    ExamResultListResponse,
    StudentGPAResponse,
    TranscriptResponse,
    ExamStatisticsResponse,
)
from app.core.services.examination_service import ExaminationService
from app.models.student import Student

router = APIRouter(prefix="/examinations", tags=["Examinations"])


# ============== Grade Scale Endpoints ==============

@router.get("/grade-scales")
async def list_grade_scales(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all grade scales."""
    service = ExaminationService(db)
    scales = await service.get_grade_scales(
        tenant_id=str(current_user.tenant_id),
        active_only=active_only,
    )
    items = [GradeScaleDetailResponse.model_validate(s) for s in scales]
    return {"items": items, "total": len(items)}


@router.post("/grade-scales", response_model=GradeScaleResponse, status_code=status.HTTP_201_CREATED)
async def create_grade_scale(
    scale_data: GradeScaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new grade scale with levels."""
    service = ExaminationService(db)
    
    levels = [level.model_dump() for level in scale_data.levels]
    
    scale = await service.create_grade_scale(
        tenant_id=str(current_user.tenant_id),
        name=scale_data.name,
        code=scale_data.code,
        description=scale_data.description,
        scale_type=scale_data.scale_type,
        academic_year=scale_data.academic_year,
        is_default=scale_data.is_default,
        levels=levels,
    )
    
    return GradeScaleResponse.model_validate(scale)


# ============== Examination Endpoints ==============

@router.get("", response_model=ExaminationListResponse)
async def list_examinations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    class_name: Optional[str] = None,
    exam_type: Optional[str] = None,
    status: Optional[str] = None,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all examinations."""
    service = ExaminationService(db)
    
    e_type = ExamType(exam_type) if exam_type else None
    e_status = ExamStatus(status) if status else None
    
    exams, total = await service.get_examinations(
        tenant_id=str(current_user.tenant_id),
        page=page,
        page_size=page_size,
        class_name=class_name,
        exam_type=e_type,
        status=e_status,
        academic_year=academic_year,
    )
    
    return ExaminationListResponse(
        items=[ExaminationResponse.model_validate(e) for e in exams],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ExaminationResponse, status_code=status.HTTP_201_CREATED)
async def create_examination(
    exam_data: ExaminationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new examination."""
    from datetime import datetime as dt
    
    service = ExaminationService(db)
    
    # Convert exam_type string to enum
    try:
        exam_type = ExamType(exam_data.exam_type)
    except ValueError:
        exam_type = ExamType.UNIT_TEST
    
    # Convert date string to datetime if needed
    exam_date = None
    if exam_data.exam_date:
        try:
            # Handle ISO format with or without time
            date_str = exam_data.exam_date
            if 'T' in date_str:
                exam_date = dt.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                exam_date = dt.strptime(date_str, '%Y-%m-%d')
        except (ValueError, AttributeError):
            exam_date = None
    
    exam = await service.create_examination(
        tenant_id=str(current_user.tenant_id),
        created_by_id=str(current_user.id),
        name=exam_data.name,
        code=exam_data.code,
        description=exam_data.description,
        exam_type=exam_type,
        course_id=str(exam_data.course_id) if exam_data.course_id else None,
        subject_name=exam_data.subject_name,
        class_name=exam_data.class_name,
        section=exam_data.section,
        academic_year=exam_data.academic_year,
        term=exam_data.term,
        exam_date=exam_date,
        start_time=None,  # Handle separately if needed
        end_time=None,
        duration_minutes=exam_data.duration_minutes,
        room_id=str(exam_data.room_id) if exam_data.room_id else None,
        venue=exam_data.venue,
        max_marks=exam_data.max_marks,
        passing_marks=exam_data.passing_marks,
        weightage=exam_data.weightage,
        grade_scale_id=str(exam_data.grade_scale_id) if exam_data.grade_scale_id else None,
        instructions=exam_data.instructions,
    )
    
    return ExaminationResponse.model_validate(exam)


@router.get("/{exam_id}", response_model=ExaminationResponse)
async def get_examination(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific examination."""
    result = await db.execute(
        select(Examination).where(
            Examination.id == exam_id,
            Examination.tenant_id == current_user.tenant_id,
        )
    )
    exam = result.scalar_one_or_none()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Examination not found",
        )
    
    return ExaminationResponse.model_validate(exam)


@router.put("/{exam_id}", response_model=ExaminationResponse)
async def update_examination(
    exam_id: UUID,
    exam_data: ExaminationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an examination."""
    result = await db.execute(
        select(Examination).where(
            Examination.id == exam_id,
            Examination.tenant_id == current_user.tenant_id,
        )
    )
    exam = result.scalar_one_or_none()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Examination not found",
        )
    
    # Update fields
    for field, value in exam_data.model_dump(exclude_unset=True).items():
        if field == "status" and value:
            setattr(exam, field, ExamStatus(value.value))
        elif field == "exam_date" and value and isinstance(value, str):
            # Convert string date to datetime
            from datetime import datetime
            try:
                setattr(exam, field, datetime.fromisoformat(value.replace('Z', '+00:00')))
            except ValueError:
                # Try parsing as date only
                setattr(exam, field, datetime.strptime(value[:10], "%Y-%m-%d"))
        else:
            setattr(exam, field, value)
    
    await db.commit()
    await db.refresh(exam)
    
    return ExaminationResponse.model_validate(exam)


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_examination(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an examination."""
    result = await db.execute(
        select(Examination).where(
            Examination.id == exam_id,
            Examination.tenant_id == current_user.tenant_id,
        )
    )
    exam = result.scalar_one_or_none()
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Examination not found",
        )
    
    # Check if exam has results - prevent deletion if results exist
    if exam.status == ExamStatus.RESULTS_PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete examination with published results",
        )
    
    await db.delete(exam)
    await db.commit()
    return None


@router.post("/{exam_id}/publish", response_model=ExaminationResponse)
async def publish_results(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish examination results."""
    service = ExaminationService(db)
    
    exam = await service.update_status(
        exam_id=str(exam_id),
        status=ExamStatus.RESULTS_PUBLISHED,
        tenant_id=str(current_user.tenant_id),
    )
    
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Examination not found",
        )
    
    return ExaminationResponse.model_validate(exam)


# ============== Results Endpoints ==============

@router.get("/{exam_id}/results", response_model=ExamResultListResponse)
async def get_exam_results(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all results for an examination."""
    service = ExaminationService(db)
    
    results = await service.get_results(str(exam_id))
    
    # Get exam for stats
    stats = await service.get_exam_statistics(str(exam_id))
    
    # Enrich with student names
    items = []
    for r in results:
        student_result = await db.execute(
            select(Student).where(Student.id == r.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        item = ExamResultDetailResponse(
            id=r.id,
            examination_id=r.examination_id,
            student_id=r.student_id,
            marks_obtained=r.marks_obtained,
            grade=r.grade,
            grade_point=r.grade_point,
            percentage=r.percentage,
            is_absent=r.is_absent,
            is_exempted=r.is_exempted,
            remarks=r.remarks,
            verified=r.verified,
            created_at=r.created_at,
            student_name=f"{student.first_name} {student.last_name or ''}" if student else None,
            student_roll_number=student.roll_number if student else None,
        )
        items.append(item)
    
    return ExamResultListResponse(
        items=items,
        total=len(items),
        average_marks=stats.get("average_marks"),
        highest_marks=stats.get("highest_marks"),
        lowest_marks=stats.get("lowest_marks"),
        pass_count=stats.get("passed", 0),
        fail_count=stats.get("failed", 0),
        absent_count=stats.get("absent", 0),
    )


@router.post("/{exam_id}/results", response_model=ExamResultResponse, status_code=status.HTTP_201_CREATED)
async def enter_result(
    exam_id: UUID,
    result_data: ExamResultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enter a single exam result."""
    service = ExaminationService(db)
    
    result = await service.enter_result(
        tenant_id=str(current_user.tenant_id),
        examination_id=str(exam_id),
        entered_by_id=str(current_user.id),
        **result_data.model_dump(),
    )
    
    return ExamResultResponse.model_validate(result)


@router.post("/{exam_id}/results/bulk", response_model=dict)
async def enter_bulk_results(
    exam_id: UUID,
    bulk_data: BulkExamResultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enter multiple exam results at once."""
    service = ExaminationService(db)
    
    results_data = [r.model_dump() for r in bulk_data.results]
    
    response = await service.enter_bulk_results(
        tenant_id=str(current_user.tenant_id),
        examination_id=str(exam_id),
        results=results_data,
        entered_by_id=str(current_user.id),
    )
    
    return {
        "success": True,
        **response,
    }


@router.delete("/{exam_id}/results/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_result(
    exam_id: UUID,
    result_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a single exam result."""
    service = ExaminationService(db)
    
    try:
        await service.delete_result(
            examination_id=str(exam_id),
            result_id=str(result_id),
            tenant_id=str(current_user.tenant_id),
        )
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{exam_id}/statistics", response_model=ExamStatisticsResponse)
async def get_exam_statistics(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get statistics for an examination."""
    service = ExaminationService(db)
    stats = await service.get_exam_statistics(str(exam_id))
    
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Examination not found or has no results",
        )
    
    return ExamStatisticsResponse(**stats)


# ============== Student Transcript & GPA ==============

@router.get("/students/{student_id}/transcript")
async def get_student_transcript(
    student_id: UUID,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get student transcript."""
    service = ExaminationService(db)
    
    try:
        transcript = await service.get_student_transcript(
            tenant_id=str(current_user.tenant_id),
            student_id=str(student_id),
            academic_year=academic_year,
        )
        return transcript
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/students/{student_id}/calculate-gpa", response_model=StudentGPAResponse)
async def calculate_student_gpa(
    student_id: UUID,
    academic_year: str,
    term: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate and store GPA for a student."""
    service = ExaminationService(db)
    
    gpa = await service.calculate_gpa(
        tenant_id=str(current_user.tenant_id),
        student_id=str(student_id),
        academic_year=academic_year,
        term=term,
    )
    
    return StudentGPAResponse.model_validate(gpa)
