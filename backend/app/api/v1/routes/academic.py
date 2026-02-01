from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from datetime import datetime
import io

from app.config import get_db
from app.api.deps import get_current_user, get_current_tenant
from app.models import User, SchoolClass, Student
from app.schemas import (
    SchoolClassCreate, 
    SchoolClassUpdate, 
    SchoolClassResponse, 
    PaginatedResponse
)
from app.core.services.import_export_service import ImportExportService

router = APIRouter()

@router.post("/classes", response_model=SchoolClassResponse, status_code=status.HTTP_201_CREATED)
async def create_school_class(
    data: SchoolClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """Create a new school class (standard/section)."""
    # Check if exists (including deleted)
    stmt = select(SchoolClass).where(
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.name == data.name,
        SchoolClass.section == data.section
    ).order_by(SchoolClass.is_deleted.asc(), SchoolClass.updated_at.desc())
    
    result = await db.execute(stmt)
    existing = result.scalars().first()
    
    if existing:
        if not existing.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Class with this name and section already exists"
            )
        
        # Reactivate soft-deleted class
        existing.is_deleted = False
        existing.deleted_at = None
        for key, value in data.model_dump().items():
            setattr(existing, key, value)
            
        await db.commit()
        await db.refresh(existing)
        
        return SchoolClassResponse(
            **{k: getattr(existing, k) for k in ['id', 'tenant_id', 'name', 'section', 'capacity', 'class_teacher_id', 'created_at', 'updated_at']},
            student_count=0
        )
    
    # Create new class
    new_class = SchoolClass(
        **data.model_dump(),
        tenant_id=tenant.id
    )
    db.add(new_class)
    await db.commit()
    await db.refresh(new_class)
    
    # Return with student_count = 0 for new class
    return SchoolClassResponse(
        **{k: getattr(new_class, k) for k in ['id', 'tenant_id', 'name', 'section', 'capacity', 'class_teacher_id', 'created_at', 'updated_at']},
        student_count=0
    )

@router.get("/classes", response_model=List[SchoolClassResponse])
async def list_school_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """List all classes for the tenant with student counts."""
    # Get all classes
    stmt = select(SchoolClass).where(
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.is_deleted == False
    ).order_by(SchoolClass.name, SchoolClass.section)
    
    result = await db.execute(stmt)
    classes = result.scalars().all()
    
    # Get student counts for each class
    count_stmt = select(
        Student.class_id,
        func.count(Student.id).label('count')
    ).where(
        Student.tenant_id == tenant.id,
        Student.is_deleted == False
    ).group_by(Student.class_id)
    
    count_result = await db.execute(count_stmt)
    counts = {str(row.class_id): row.count for row in count_result.all()}
    
    # Build response with student counts
    response = []
    for cls in classes:
        response.append(SchoolClassResponse(
            id=cls.id,
            tenant_id=cls.tenant_id,
            name=cls.name,
            section=cls.section,
            capacity=cls.capacity,
            class_teacher_id=cls.class_teacher_id,
            student_count=counts.get(str(cls.id), 0),
            created_at=cls.created_at,
            updated_at=cls.updated_at
        ))
    
    return response

# Import/Export Routes - Must be before dynamic routes
@router.get("/classes/template", response_class=StreamingResponse)
async def get_classes_import_template(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """Download classes import template."""
    service = ImportExportService(db)
    content = service.get_classes_import_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=classes_import_template.csv"}
    )

@router.post("/classes/import", status_code=status.HTTP_200_OK)
async def import_classes(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """Import classes from CSV/Excel."""
    service = ImportExportService(db)
    content = await file.read()
    
    if file.filename.endswith(('.xlsx', '.xls')):
        result = await service.import_classes_from_excel(tenant.id, content)
    else:
        result = await service.import_classes_from_csv(tenant.id, content)
        
    return result

@router.get("/classes/export", response_class=StreamingResponse)
async def export_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """Export classes to CSV."""
    service = ImportExportService(db)
    content = await service.export_classes_to_csv(tenant.id)
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=classes_export_{datetime.now().date()}.csv"}
    )

@router.get("/classes/{class_id}", response_model=SchoolClassResponse)
async def get_school_class(
    class_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    stmt = select(SchoolClass).where(
        SchoolClass.id == class_id,
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.is_deleted == False
    )
    result = await db.execute(stmt)
    school_class = result.scalar_one_or_none()
    
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Get student count
    count_stmt = select(func.count(Student.id)).where(
        Student.class_id == class_id,
        Student.tenant_id == tenant.id,
        Student.is_deleted == False
    )
    count_result = await db.execute(count_stmt)
    student_count = count_result.scalar() or 0
    
    return SchoolClassResponse(
        id=school_class.id,
        tenant_id=school_class.tenant_id,
        name=school_class.name,
        section=school_class.section,
        capacity=school_class.capacity,
        class_teacher_id=school_class.class_teacher_id,
        student_count=student_count,
        created_at=school_class.created_at,
        updated_at=school_class.updated_at
    )

@router.put("/classes/{class_id}", response_model=SchoolClassResponse)
async def update_school_class(
    class_id: UUID,
    data: SchoolClassUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    stmt = select(SchoolClass).where(
        SchoolClass.id == class_id,
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.is_deleted == False
    )
    result = await db.execute(stmt)
    school_class = result.scalar_one_or_none()
    
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(school_class, field, value)
    
    await db.commit()
    await db.refresh(school_class)
    
    # Get student count
    count_stmt = select(func.count(Student.id)).where(
        Student.class_id == class_id,
        Student.tenant_id == tenant.id,
        Student.is_deleted == False
    )
    count_result = await db.execute(count_stmt)
    student_count = count_result.scalar() or 0
    
    return SchoolClassResponse(
        id=school_class.id,
        tenant_id=school_class.tenant_id,
        name=school_class.name,
        section=school_class.section,
        capacity=school_class.capacity,
        class_teacher_id=school_class.class_teacher_id,
        student_count=student_count,
        created_at=school_class.created_at,
        updated_at=school_class.updated_at
    )

@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_school_class(
    class_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    stmt = select(SchoolClass).where(
        SchoolClass.id == class_id,
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.is_deleted == False
    )
    result = await db.execute(stmt)
    school_class = result.scalar_one_or_none()
    
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Soft delete
    school_class.is_deleted = True
    school_class.deleted_at = datetime.utcnow()
    await db.commit()
