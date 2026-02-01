"""
Staff API Router - CRUD operations for staff/employees
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
import io
from app.core.services.import_export_service import ImportExportService
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime, date
import math
import logging

from app.config.database import get_db
from app.models import Staff, StaffStatus, StaffType, Tenant, SchoolClass
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/staff", tags=["Staff"])


# Pydantic Schemas
class StaffBase(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    staff_type: Optional[str] = "teaching"
    designation: Optional[str] = None
    department: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    joining_date: Optional[date] = None
    basic_salary: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = "active"
    class_ids: Optional[List[UUID]] = []  # Added for class association


class StaffCreate(StaffBase):
    pass


class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    staff_type: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    basic_salary: Optional[float] = None
    status: Optional[str] = None
    class_ids: Optional[List[UUID]] = None

from app.schemas.academic import SchoolClassResponse  # Import for response

class StaffResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    employee_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    staff_type: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    joining_date: Optional[date] = None
    basic_salary: Optional[float] = None
    status: str
    avatar_url: Optional[str] = None
    associated_classes: List[SchoolClassResponse] = []  # Added response field
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class StaffListResponse(BaseModel):
    items: List[StaffResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=StaffListResponse)
@require_permission("staff", "read")
async def list_staff(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    staff_type: Optional[str] = None,
    department: Optional[str] = None,
    class_id: Optional[UUID] = None, # Added filter
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all staff with pagination and filtering."""
    try:
        query = select(Staff).options(selectinload(Staff.associated_classes)).where(
            Staff.is_deleted == False,
            Staff.tenant_id == current_user.tenant_id  # Tenant isolation
        )
        
        if search:
            search_filter = or_(
                Staff.first_name.ilike(f"%{search}%"),
                Staff.last_name.ilike(f"%{search}%"),
                Staff.employee_id.ilike(f"%{search}%"),
                Staff.email.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
        
        if staff_type:
            query = query.where(Staff.staff_type == staff_type)
        
        if department:
            query = query.where(Staff.department == department)

        if class_id:
            query = query.where(Staff.associated_classes.any(id=class_id))
        
        count_query = select(func.count(Staff.id)).where(
            Staff.is_deleted == False,
            Staff.tenant_id == current_user.tenant_id
        )
        if class_id:
             # For accurate count with join filter, complex count is needed or just skip distinct count for simplicity if small data.
             # Actually .any generates EXISTS subquery, so count works fine.
             count_query = count_query.where(Staff.associated_classes.any(id=class_id))

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(Staff.created_at.desc())
        
        result = await db.execute(query)
        staff_list = result.scalars().all()
        
        return StaffListResponse(
            items=staff_list,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 1,
        )
    except Exception as e:
        logger.error(f"Error listing staff: {e}")
        raise HTTPException(status_code=500, detail="An error occurred")


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
@require_permission("staff", "create")
async def create_staff(
    request: Request,
    staff_data: StaffCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new staff member."""
    try:
        existing = await db.execute(
            select(Staff).where(
                Staff.employee_id == staff_data.employee_id,
                Staff.tenant_id == current_user.tenant_id,
                Staff.is_deleted == False
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Employee ID already exists")
        
        # Prepare data
        data_dict = staff_data.model_dump()
        class_ids = data_dict.pop('class_ids', [])
        
        staff = Staff(**data_dict)
        staff.tenant_id = current_user.tenant_id
        
        # Handle class associations
        if class_ids:
            stmt = select(SchoolClass).where(SchoolClass.id.in_(class_ids))
            result = await db.execute(stmt)
            classes = result.scalars().all()
            staff.associated_classes = classes
        
        db.add(staff)
        await db.commit()
        await db.refresh(staff)
        
        # Reload to get relationships
        stmt = select(Staff).options(selectinload(Staff.associated_classes)).where(Staff.id == staff.id)
        result = await db.execute(stmt)
        return result.scalar_one()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating staff: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="An error occurred")


# Import/Export Routes

@router.get("/template", response_class=StreamingResponse)
@require_permission("staff", "create")
async def get_staff_import_template(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download staff import template."""
    service = ImportExportService(db)
    content = service.get_staff_import_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=staff_import_template.csv"}
    )

@router.post("/import", status_code=status.HTTP_200_OK)
@require_permission("staff", "create")
async def import_staff(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import staff from CSV/Excel."""
    service = ImportExportService(db)
    content = await file.read()
    
    if file.filename.endswith(('.xlsx', '.xls')):
        result = await service.import_staff_from_excel(current_user.tenant_id, content)
    else:
        result = await service.import_staff_from_csv(current_user.tenant_id, content)
        
    return result

@router.get("/export", response_class=StreamingResponse)
@require_permission("staff", "read")
async def export_staff(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export staff to CSV."""
    service = ImportExportService(db)
    content = await service.export_staff_to_csv(current_user.tenant_id)
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=staff_export_{date.today()}.csv"}
    )


@router.get("/{staff_id}", response_model=StaffResponse)
@require_permission("staff", "read")
async def get_staff(
    request: Request,
    staff_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single staff member by ID."""
    result = await db.execute(
        select(Staff).options(selectinload(Staff.associated_classes)).where(
            Staff.id == staff_id,
            Staff.tenant_id == current_user.tenant_id,
            Staff.is_deleted == False
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff


@router.put("/{staff_id}", response_model=StaffResponse)
@require_permission("staff", "update")
async def update_staff(
    request: Request,
    staff_id: UUID,
    staff_data: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a staff member."""
    result = await db.execute(
        select(Staff).options(selectinload(Staff.associated_classes)).where(
            Staff.id == staff_id,
            Staff.tenant_id == current_user.tenant_id,
            Staff.is_deleted == False
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    update_data = staff_data.model_dump(exclude_unset=True)
    class_ids = update_data.pop('class_ids', None) # Pop explicitly
    
    for field, value in update_data.items():
        setattr(staff, field, value)
    
    if class_ids is not None:
        stmt = select(SchoolClass).where(SchoolClass.id.in_(class_ids))
        classes_result = await db.execute(stmt)
        classes = classes_result.scalars().all()
        staff.associated_classes = classes
    
    await db.commit()
    await db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("staff", "delete")
async def delete_staff(
    request: Request,
    staff_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a staff member."""
    result = await db.execute(
        select(Staff).where(
            Staff.id == staff_id,
            Staff.tenant_id == current_user.tenant_id,
            Staff.is_deleted == False
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    staff.is_deleted = True
    staff.deleted_at = datetime.utcnow()
    staff.deleted_by = current_user.id
    await db.commit()
    return None


