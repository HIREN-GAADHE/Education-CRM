"""
PTM (Parent-Teacher Meeting) API Routes
"""
import uuid
import math
import logging
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.config.database import get_db
from app.models.user import User
from app.models.ptm import PTMSlot, PTMSession, PTMRemark, PTMSessionStatus, PTMReviewerType
from app.models.staff import Staff
from app.models.student import Student
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ptm", tags=["PTM"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class TeacherMini(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    class Config:
        from_attributes = True


class StudentMini(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    admission_number: str
    class Config:
        from_attributes = True


class PTMSlotCreate(BaseModel):
    date: date
    start_time: time
    end_time: time
    notes: Optional[str] = None


class PTMSlotResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    teacher_id: UUID
    teacher: Optional[TeacherMini] = None
    date: date
    start_time: time
    end_time: time
    is_booked: bool
    notes: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class PTMSlotListResponse(BaseModel):
    items: List[PTMSlotResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PTMSessionCreate(BaseModel):
    slot_id: UUID
    student_id: UUID
    reason: Optional[str] = None


class PTMSessionStatusUpdate(BaseModel):
    status: PTMSessionStatus


class PTMSessionResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    slot_id: Optional[UUID] = None
    teacher_id: UUID
    teacher: Optional[TeacherMini] = None
    student_id: UUID
    student: Optional[StudentMini] = None
    parent_user_id: UUID
    scheduled_at: Optional[datetime] = None
    duration_minutes: int
    status: str
    meeting_link: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class PTMSessionListResponse(BaseModel):
    items: List[PTMSessionResponse]
    total: int


class PTMRemarkCreate(BaseModel):
    content: str
    is_private: bool = False


class PTMRemarkResponse(BaseModel):
    id: UUID
    session_id: UUID
    author_user_id: UUID
    author_type: str
    content: str
    is_private: bool
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Slots ────────────────────────────────────────────────────────────────────

@router.get("/slots", response_model=PTMSlotListResponse)
@require_permission("ptm", "read")
async def list_ptm_slots(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    slot_date: Optional[date] = Query(None, alias="date"),
    teacher_id: Optional[UUID] = None,
    available_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List PTM slots with optional filters."""
    try:
        filters = [
            PTMSlot.tenant_id == current_user.tenant_id,
            PTMSlot.is_deleted == False,
        ]
        if slot_date:
            filters.append(PTMSlot.date == slot_date)
        if teacher_id:
            filters.append(PTMSlot.teacher_id == teacher_id)
        if available_only:
            filters.append(PTMSlot.is_booked == False)

        total = (await db.execute(select(func.count(PTMSlot.id)).where(*filters))).scalar() or 0
        offset = (page - 1) * page_size

        result = await db.execute(
            select(PTMSlot)
            .options(joinedload(PTMSlot.teacher))
            .where(*filters)
            .offset(offset).limit(page_size)
            .order_by(PTMSlot.date, PTMSlot.start_time)
        )
        items = result.scalars().all()

        return PTMSlotListResponse(
            items=items, total=total, page=page, page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing PTM slots: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch PTM slots")


@router.post("/slots", response_model=PTMSlotResponse, status_code=status.HTTP_201_CREATED)
@require_permission("ptm", "create")
async def create_ptm_slot(
    request: Request,
    data: PTMSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teacher/Admin creates an available PTM slot."""
    try:
        # Find staff record by email
        staff_result = await db.execute(
            select(Staff).where(
                Staff.email == current_user.email,
                Staff.tenant_id == current_user.tenant_id,
                Staff.is_deleted == False,
            )
        )
        staff = staff_result.scalar_one_or_none()

        if not staff:
            # Admin fallback: pick any staff
            staff_result = await db.execute(
                select(Staff).where(
                    Staff.tenant_id == current_user.tenant_id,
                    Staff.is_deleted == False,
                ).limit(1)
            )
            staff = staff_result.scalar_one_or_none()

        if not staff:
            raise HTTPException(status_code=400, detail="No staff record found. Please create a staff profile first.")

        slot = PTMSlot(
            tenant_id=current_user.tenant_id,
            teacher_id=staff.id,
            date=data.date,
            start_time=data.start_time,
            end_time=data.end_time,
            notes=data.notes,
            is_booked=False,
        )
        db.add(slot)
        await db.commit()
        await db.refresh(slot)

        result = await db.execute(
            select(PTMSlot).options(joinedload(PTMSlot.teacher)).where(PTMSlot.id == slot.id)
        )
        return result.scalar_one()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating PTM slot: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create PTM slot")


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("ptm", "delete")
async def delete_ptm_slot(
    request: Request,
    slot_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete an unbooked PTM slot."""
    result = await db.execute(
        select(PTMSlot).where(
            PTMSlot.id == slot_id,
            PTMSlot.tenant_id == current_user.tenant_id,
            PTMSlot.is_deleted == False,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Cannot delete a booked slot. Cancel the session first.")

    slot.is_deleted = True
    slot.deleted_at = datetime.utcnow()
    slot.deleted_by = current_user.id
    await db.commit()
    return None


# ─── Sessions ─────────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=PTMSessionResponse, status_code=status.HTTP_201_CREATED)
@require_permission("ptm", "create")
async def book_ptm_session(
    request: Request,
    data: PTMSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parent books a PTM slot. Auto-generates a Google Meet-style link."""
    try:
        slot_result = await db.execute(
            select(PTMSlot).where(
                PTMSlot.id == data.slot_id,
                PTMSlot.tenant_id == current_user.tenant_id,
                PTMSlot.is_deleted == False,
            )
        )
        slot = slot_result.scalar_one_or_none()
        if not slot:
            raise HTTPException(status_code=404, detail="PTM slot not found")
        if slot.is_booked:
            raise HTTPException(status_code=400, detail="This slot has already been booked")

        student_result = await db.execute(
            select(Student).where(
                Student.id == data.student_id,
                Student.tenant_id == current_user.tenant_id,
                Student.is_deleted == False,
            )
        )
        if not student_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Student not found")

        # Generate meet link
        code = str(uuid.uuid4()).replace("-", "")
        meet_link = f"https://meet.google.com/{code[:3]}-{code[3:7]}-{code[7:11]}"
        scheduled_at = datetime.combine(slot.date, slot.start_time)
        duration = int((datetime.combine(slot.date, slot.end_time) - scheduled_at).seconds / 60)

        session = PTMSession(
            tenant_id=current_user.tenant_id,
            slot_id=slot.id,
            teacher_id=slot.teacher_id,
            student_id=data.student_id,
            parent_user_id=current_user.id,
            scheduled_at=scheduled_at,
            duration_minutes=max(duration, 1),
            status=PTMSessionStatus.SCHEDULED,
            meeting_link=meet_link,
            reason=data.reason,
        )
        slot.is_booked = True
        db.add(session)
        db.add(slot)
        await db.commit()
        await db.refresh(session)

        result = await db.execute(
            select(PTMSession)
            .options(joinedload(PTMSession.teacher), joinedload(PTMSession.student))
            .where(PTMSession.id == session.id)
        )
        return result.scalar_one()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error booking PTM session: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to book PTM session")


@router.get("/sessions", response_model=PTMSessionListResponse)
@require_permission("ptm", "read")
async def list_ptm_sessions(
    request: Request,
    session_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List PTM sessions. Parents see only their own."""
    try:
        filters = [
            PTMSession.tenant_id == current_user.tenant_id,
            PTMSession.is_deleted == False,
        ]
        role_level = getattr(current_user, 'role_level', 10)
        if role_level >= 8:
            filters.append(PTMSession.parent_user_id == current_user.id)
        if session_status:
            filters.append(PTMSession.status == session_status)

        result = await db.execute(
            select(PTMSession)
            .options(joinedload(PTMSession.teacher), joinedload(PTMSession.student))
            .where(*filters)
            .order_by(PTMSession.scheduled_at.desc())
        )
        items = result.scalars().all()
        return PTMSessionListResponse(items=items, total=len(items))
    except Exception as e:
        logger.error(f"Error listing PTM sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch PTM sessions")


@router.patch("/sessions/{session_id}/status", response_model=PTMSessionResponse)
@require_permission("ptm", "update")
async def update_session_status(
    request: Request,
    session_id: UUID,
    data: PTMSessionStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teacher marks a session as COMPLETED or CANCELLED."""
    result = await db.execute(
        select(PTMSession)
        .options(joinedload(PTMSession.teacher), joinedload(PTMSession.student))
        .where(
            PTMSession.id == session_id,
            PTMSession.tenant_id == current_user.tenant_id,
            PTMSession.is_deleted == False,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if data.status == PTMSessionStatus.CANCELLED and session.slot_id:
        slot_res = await db.execute(select(PTMSlot).where(PTMSlot.id == session.slot_id))
        slot = slot_res.scalar_one_or_none()
        if slot:
            slot.is_booked = False
            db.add(slot)

    session.status = data.status
    await db.commit()
    await db.refresh(session)
    return session


# ─── Remarks ──────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/remarks", response_model=PTMRemarkResponse, status_code=status.HTTP_201_CREATED)
@require_permission("ptm", "create")
async def add_remark(
    request: Request,
    session_id: UUID,
    data: PTMRemarkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_res = await db.execute(
        select(PTMSession).where(
            PTMSession.id == session_id,
            PTMSession.tenant_id == current_user.tenant_id,
            PTMSession.is_deleted == False,
        )
    )
    if not session_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    role_level = getattr(current_user, 'role_level', 10)
    author_type = PTMReviewerType.PARENT if role_level >= 8 else PTMReviewerType.TEACHER

    remark = PTMRemark(
        tenant_id=current_user.tenant_id,
        session_id=session_id,
        author_user_id=current_user.id,
        author_type=author_type,
        content=data.content,
        is_private=data.is_private,
    )
    db.add(remark)
    await db.commit()
    await db.refresh(remark)
    return remark


@router.get("/sessions/{session_id}/remarks", response_model=List[PTMRemarkResponse])
@require_permission("ptm", "read")
async def get_remarks(
    request: Request,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PTMRemark)
        .where(PTMRemark.session_id == session_id, PTMRemark.tenant_id == current_user.tenant_id)
        .order_by(PTMRemark.created_at)
    )
    return result.scalars().all()
