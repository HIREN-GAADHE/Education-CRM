"""
Student Health Records API Routes
"""
import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.config.database import get_db
from app.models.user import User
from app.models.health import StudentHealthRecord, NurseVisit, Vaccination, VaccinationStatus
from app.models.student import Student
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health-records", tags=["Health Records"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class HealthRecordUpsert(BaseModel):
    blood_group: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    vision_left: Optional[str] = None
    vision_right: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    special_needs: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    family_doctor_name: Optional[str] = None
    family_doctor_phone: Optional[str] = None
    health_insurance_number: Optional[str] = None
    notes: Optional[str] = None


class HealthRecordResponse(BaseModel):
    id: UUID
    student_id: UUID
    blood_group: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    vision_left: Optional[str] = None
    vision_right: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    special_needs: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    family_doctor_name: Optional[str] = None
    family_doctor_phone: Optional[str] = None
    health_insurance_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


class NurseVisitCreate(BaseModel):
    visit_date: datetime
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_given: Optional[str] = None
    medication_given: Optional[str] = None
    sent_home: bool = False
    parent_notified: bool = False
    follow_up_required: bool = False
    follow_up_date: Optional[date] = None
    notes: Optional[str] = None


class NurseVisitResponse(BaseModel):
    id: UUID
    student_id: UUID
    visit_date: datetime
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_given: Optional[str] = None
    medication_given: Optional[str] = None
    sent_home: bool
    parent_notified: bool
    follow_up_required: bool
    follow_up_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class VaccinationCreate(BaseModel):
    vaccine_name: str
    dose_number: int = 1
    administered_date: Optional[date] = None
    administered_by: Optional[str] = None
    next_due_date: Optional[date] = None
    status: str = VaccinationStatus.COMPLETED
    batch_number: Optional[str] = None
    notes: Optional[str] = None


class VaccinationResponse(BaseModel):
    id: UUID
    student_id: UUID
    vaccine_name: str
    dose_number: int
    administered_date: Optional[date] = None
    administered_by: Optional[str] = None
    next_due_date: Optional[date] = None
    status: str
    batch_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Health Record (Upsert) ───────────────────────────────────────────────────

@router.get("/students/{student_id}", response_model=HealthRecordResponse)
@require_permission("health_records", "read")
async def get_health_record(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(StudentHealthRecord).where(
            StudentHealthRecord.student_id == student_id,
            StudentHealthRecord.tenant_id == current_user.tenant_id,
            StudentHealthRecord.is_deleted == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")
    return record


@router.put("/students/{student_id}", response_model=HealthRecordResponse)
@require_permission("health_records", "update")
async def upsert_health_record(
    request: Request,
    student_id: UUID,
    data: HealthRecordUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a student's health record."""
    try:
        # Verify student belongs to tenant
        student_res = await db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == current_user.tenant_id,
                Student.is_deleted == False,
            )
        )
        if not student_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Student not found")

        result = await db.execute(
            select(StudentHealthRecord).where(
                StudentHealthRecord.student_id == student_id,
                StudentHealthRecord.tenant_id == current_user.tenant_id,
                StudentHealthRecord.is_deleted == False,
            )
        )
        record = result.scalar_one_or_none()

        if record:
            for key, value in data.dict(exclude_none=True).items():
                setattr(record, key, value)
        else:
            record = StudentHealthRecord(
                tenant_id=current_user.tenant_id,
                student_id=student_id,
                **data.dict(exclude_none=True),
            )
            db.add(record)

        await db.commit()
        await db.refresh(record)
        return record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error upserting health record: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save health record")


# ─── Nurse Visits ─────────────────────────────────────────────────────────────

@router.get("/students/{student_id}/visits", response_model=List[NurseVisitResponse])
@require_permission("health_records", "read")
async def list_visits(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NurseVisit).where(
            NurseVisit.student_id == student_id,
            NurseVisit.tenant_id == current_user.tenant_id,
            NurseVisit.is_deleted == False,
        ).order_by(NurseVisit.visit_date.desc())
    )
    return result.scalars().all()


@router.post("/students/{student_id}/visits", response_model=NurseVisitResponse,
             status_code=status.HTTP_201_CREATED)
@require_permission("health_records", "create")
async def log_visit(
    request: Request,
    student_id: UUID,
    data: NurseVisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # Get or create health record
        hr_result = await db.execute(
            select(StudentHealthRecord).where(
                StudentHealthRecord.student_id == student_id,
                StudentHealthRecord.tenant_id == current_user.tenant_id,
                StudentHealthRecord.is_deleted == False,
            )
        )
        health_record = hr_result.scalar_one_or_none()
        if not health_record:
            health_record = StudentHealthRecord(
                tenant_id=current_user.tenant_id,
                student_id=student_id,
            )
            db.add(health_record)
            await db.flush()

        visit = NurseVisit(
            tenant_id=current_user.tenant_id,
            health_record_id=health_record.id,
            student_id=student_id,
            recorded_by=current_user.id,
            **data.dict(),
        )
        db.add(visit)
        await db.commit()
        await db.refresh(visit)
        return visit
    except Exception as e:
        logger.error(f"Error logging nurse visit: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to log nurse visit")


@router.delete("/visits/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("health_records", "delete")
async def delete_visit(
    request: Request,
    visit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NurseVisit).where(
            NurseVisit.id == visit_id,
            NurseVisit.tenant_id == current_user.tenant_id,
            NurseVisit.is_deleted == False,
        )
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    visit.is_deleted = True
    visit.deleted_at = datetime.utcnow()
    visit.deleted_by = current_user.id
    await db.commit()
    return None


# ─── Vaccinations ─────────────────────────────────────────────────────────────

@router.get("/students/{student_id}/vaccinations", response_model=List[VaccinationResponse])
@require_permission("health_records", "read")
async def list_vaccinations(
    request: Request,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Vaccination).where(
            Vaccination.student_id == student_id,
            Vaccination.tenant_id == current_user.tenant_id,
            Vaccination.is_deleted == False,
        ).order_by(Vaccination.administered_date.desc())
    )
    return result.scalars().all()


@router.post("/students/{student_id}/vaccinations", response_model=VaccinationResponse,
             status_code=status.HTTP_201_CREATED)
@require_permission("health_records", "create")
async def add_vaccination(
    request: Request,
    student_id: UUID,
    data: VaccinationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        hr_result = await db.execute(
            select(StudentHealthRecord).where(
                StudentHealthRecord.student_id == student_id,
                StudentHealthRecord.tenant_id == current_user.tenant_id,
                StudentHealthRecord.is_deleted == False,
            )
        )
        health_record = hr_result.scalar_one_or_none()
        if not health_record:
            health_record = StudentHealthRecord(
                tenant_id=current_user.tenant_id,
                student_id=student_id,
            )
            db.add(health_record)
            await db.flush()

        vaccination = Vaccination(
            tenant_id=current_user.tenant_id,
            health_record_id=health_record.id,
            student_id=student_id,
            **data.dict(),
        )
        db.add(vaccination)
        await db.commit()
        await db.refresh(vaccination)
        return vaccination
    except Exception as e:
        logger.error(f"Error adding vaccination: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to add vaccination")


@router.delete("/vaccinations/{vaccination_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("health_records", "delete")
async def delete_vaccination(
    request: Request,
    vaccination_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Vaccination).where(
            Vaccination.id == vaccination_id,
            Vaccination.tenant_id == current_user.tenant_id,
            Vaccination.is_deleted == False,
        )
    )
    vax = result.scalar_one_or_none()
    if not vax:
        raise HTTPException(status_code=404, detail="Vaccination not found")
    vax.is_deleted = True
    vax.deleted_at = datetime.utcnow()
    vax.deleted_by = current_user.id
    await db.commit()
    return None
