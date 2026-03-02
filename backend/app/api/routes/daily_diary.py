"""
Daily Diary / Behavior Tracking API Routes
"""
import logging
import math
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.config.database import get_db
from app.models.user import User
from app.models.daily_diary import DailyDiary, MoodType
from app.models.staff import Staff
from app.models.student import Student
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/daily-diary", tags=["Daily Diary"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class DiaryCreate(BaseModel):
    student_id: UUID
    entry_date: date
    mood: Optional[str] = None
    behavior_score: Optional[int] = None  # 1-5
    attendance_status: Optional[str] = None
    academic_notes: Optional[str] = None
    behavior_notes: Optional[str] = None
    homework_status: Optional[str] = None
    homework_notes: Optional[str] = None
    is_shared_with_parent: bool = True


class DiaryUpdate(BaseModel):
    mood: Optional[str] = None
    behavior_score: Optional[int] = None
    attendance_status: Optional[str] = None
    academic_notes: Optional[str] = None
    behavior_notes: Optional[str] = None
    homework_status: Optional[str] = None
    homework_notes: Optional[str] = None
    is_shared_with_parent: Optional[bool] = None


class StudentMini(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    admission_number: str
    class Config:
        from_attributes = True


class TeacherMini(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    class Config:
        from_attributes = True


class DiaryResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    student_id: UUID
    student: Optional[StudentMini] = None
    teacher_id: Optional[UUID] = None
    teacher: Optional[TeacherMini] = None
    entry_date: date
    mood: Optional[str] = None
    behavior_score: Optional[int] = None
    attendance_status: Optional[str] = None
    academic_notes: Optional[str] = None
    behavior_notes: Optional[str] = None
    homework_status: Optional[str] = None
    homework_notes: Optional[str] = None
    is_shared_with_parent: bool
    parent_acknowledged: bool
    created_at: datetime
    class Config:
        from_attributes = True


class DiaryListResponse(BaseModel):
    items: List[DiaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=DiaryListResponse)
@require_permission("daily_diary", "read")
async def list_diary_entries(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    student_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        filters = [
            DailyDiary.tenant_id == current_user.tenant_id,
            DailyDiary.is_deleted == False,
        ]
        role_level = getattr(request.state, 'role_level', 10)
        # Parents/Guardians only see entries shared with them; teachers see all
        if role_level >= 8:
            filters.append(DailyDiary.is_shared_with_parent == True)

        if student_id:
            filters.append(DailyDiary.student_id == student_id)
        if date_from:
            filters.append(DailyDiary.entry_date >= date_from)
        if date_to:
            filters.append(DailyDiary.entry_date <= date_to)

        total = (await db.execute(
            select(func.count(DailyDiary.id)).where(*filters)
        )).scalar() or 0

        result = await db.execute(
            select(DailyDiary)
            .options(joinedload(DailyDiary.student), joinedload(DailyDiary.teacher))
            .where(*filters)
            .offset((page - 1) * page_size).limit(page_size)
            .order_by(DailyDiary.entry_date.desc())
        )
        items = result.scalars().all()
        return DiaryListResponse(
            items=items, total=total, page=page, page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing diary entries: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch diary entries")


@router.post("", response_model=DiaryResponse, status_code=status.HTTP_201_CREATED)
@require_permission("daily_diary", "create")
async def create_diary_entry(
    request: Request,
    data: DiaryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teacher creates or updates a diary entry for a student on a given date."""
    try:
        # Find teacher's staff record
        staff_result = await db.execute(
            select(Staff).where(
                Staff.email == current_user.email,
                Staff.tenant_id == current_user.tenant_id,
                Staff.is_deleted == False,
            )
        )
        staff = staff_result.scalar_one_or_none()

        # Check if entry already exists for this student+date → update instead
        existing_result = await db.execute(
            select(DailyDiary).where(
                DailyDiary.student_id == data.student_id,
                DailyDiary.entry_date == data.entry_date,
                DailyDiary.tenant_id == current_user.tenant_id,
                DailyDiary.is_deleted == False,
            )
        )
        entry = existing_result.scalar_one_or_none()

        if entry:
            for key, value in data.dict(exclude={'student_id', 'entry_date'}).items():
                if value is not None:
                    setattr(entry, key, value)
        else:
            entry = DailyDiary(
                tenant_id=current_user.tenant_id,
                teacher_id=staff.id if staff else None,
                recorded_by=current_user.id,
                **data.dict(),
            )
            db.add(entry)

        await db.commit()
        await db.refresh(entry)

        result = await db.execute(
            select(DailyDiary)
            .options(joinedload(DailyDiary.student), joinedload(DailyDiary.teacher))
            .where(DailyDiary.id == entry.id)
        )
        return result.scalar_one()
    except Exception as e:
        logger.error(f"Error creating diary entry: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save diary entry")


@router.patch("/{entry_id}", response_model=DiaryResponse)
@require_permission("daily_diary", "update")
async def update_diary_entry(
    request: Request,
    entry_id: UUID,
    data: DiaryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DailyDiary)
        .options(joinedload(DailyDiary.student), joinedload(DailyDiary.teacher))
        .where(
            DailyDiary.id == entry_id,
            DailyDiary.tenant_id == current_user.tenant_id,
            DailyDiary.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Diary entry not found")

    for key, value in data.dict(exclude_none=True).items():
        setattr(entry, key, value)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/{entry_id}/acknowledge", response_model=DiaryResponse)
@require_permission("daily_diary", "update")
async def parent_acknowledge(
    request: Request,
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parent acknowledges reading a diary entry."""
    result = await db.execute(
        select(DailyDiary).where(
            DailyDiary.id == entry_id,
            DailyDiary.tenant_id == current_user.tenant_id,
            DailyDiary.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.parent_acknowledged = True
    entry.parent_acknowledged_at = datetime.utcnow()
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/student/{student_id}/summary")
@require_permission("daily_diary", "read")
async def get_mood_summary(
    request: Request,
    student_id: UUID,
    days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns mood distribution and avg behavior score for the last N days."""
    from datetime import timedelta
    date_from = date.today() - timedelta(days=days)

    result = await db.execute(
        select(DailyDiary).where(
            DailyDiary.student_id == student_id,
            DailyDiary.tenant_id == current_user.tenant_id,
            DailyDiary.entry_date >= date_from,
            DailyDiary.is_deleted == False,
        ).order_by(DailyDiary.entry_date)
    )
    entries = result.scalars().all()

    mood_counts: Dict[str, int] = {}
    total_behavior = 0
    behavior_count = 0

    for e in entries:
        if e.mood:
            mood_counts[e.mood] = mood_counts.get(e.mood, 0) + 1
        if e.behavior_score:
            total_behavior += e.behavior_score
            behavior_count += 1

    return {
        "student_id": str(student_id),
        "period_days": days,
        "total_entries": len(entries),
        "mood_distribution": mood_counts,
        "avg_behavior_score": round(total_behavior / behavior_count, 2) if behavior_count > 0 else None,
    }
