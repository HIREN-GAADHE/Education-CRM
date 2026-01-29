from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime

from app.config import get_db
from app.api.deps import get_current_user, get_current_tenant
from app.models import User, SchoolClass
from app.schemas import (
    SchoolClassCreate, 
    SchoolClassUpdate, 
    SchoolClassResponse, 
    PaginatedResponse
)

router = APIRouter()

@router.post("/classes", response_model=SchoolClassResponse, status_code=status.HTTP_201_CREATED)
async def create_school_class(
    data: SchoolClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """Create a new school class (standard/section)."""
    # Check if exists
    stmt = select(SchoolClass).where(
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.name == data.name,
        SchoolClass.section == data.section
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class with this name and section already exists"
        )
    
    new_class = SchoolClass(
        **data.model_dump(),
        tenant_id=tenant.id
    )
    db.add(new_class)
    await db.commit()
    await db.refresh(new_class)
    return new_class

@router.get("/classes", response_model=List[SchoolClassResponse])
async def list_school_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant)
):
    """List all classes for the tenant."""
    stmt = select(SchoolClass).where(
        SchoolClass.tenant_id == tenant.id,
        SchoolClass.is_deleted == False
    ).order_by(SchoolClass.name, SchoolClass.section)
    
    result = await db.execute(stmt)
    return result.scalars().all()

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
        
    return school_class

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
    return school_class

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
