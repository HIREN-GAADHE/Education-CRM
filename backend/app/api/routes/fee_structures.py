"""
Fee Structure API Router - CRUD operations for predefined fee structures
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
import logging

from app.config.database import get_db
from app.models.fee import FeeStructure
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fee-structures", tags=["Fee Structures"])


# --- Schemas ---

class FeeComponentSchema(BaseModel):
    name: str
    type: str  # tuition, lab, library, etc.
    amount: float
    optional: bool = False


class FeeStructureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    course: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    academic_year: Optional[str] = None
    fee_components: Optional[List[FeeComponentSchema]] = []
    total_amount: float = 0
    is_active: bool = True


class FeeStructureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    course: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    academic_year: Optional[str] = None
    fee_components: Optional[List[FeeComponentSchema]] = None
    total_amount: Optional[float] = None
    is_active: Optional[bool] = None


class FeeStructureResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str] = None
    course: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    academic_year: Optional[str] = None
    fee_components: Optional[list] = []
    total_amount: float
    is_active: bool
    
    class Config:
        from_attributes = True


# --- Routes ---

@router.get("", response_model=List[FeeStructureResponse])
@require_permission("fees", "read")
async def list_fee_structures(
    request: Request,
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all fee structures for the current tenant."""
    query = select(FeeStructure).where(
        FeeStructure.tenant_id == current_user.tenant_id
    )
    if active_only:
        query = query.where(FeeStructure.is_active == True)
    
    query = query.order_by(FeeStructure.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=FeeStructureResponse, status_code=status.HTTP_201_CREATED)
@require_permission("fees", "create")
async def create_fee_structure(
    request: Request,
    data: FeeStructureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new fee structure."""
    try:
        # Auto-calculate total if components provided and total is 0
        total = data.total_amount
        if data.fee_components and total == 0:
            total = sum(c.amount for c in data.fee_components)
        
        structure = FeeStructure(
            tenant_id=current_user.tenant_id,
            name=data.name,
            description=data.description,
            course=data.course,
            department=data.department,
            batch=data.batch,
            academic_year=data.academic_year,
            fee_components=[c.model_dump() for c in data.fee_components] if data.fee_components else [],
            total_amount=total,
            is_active=data.is_active,
        )
        db.add(structure)
        await db.commit()
        await db.refresh(structure)
        return structure
    except Exception as e:
        logger.error(f"Error creating fee structure: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create fee structure")


@router.put("/{structure_id}", response_model=FeeStructureResponse)
@require_permission("fees", "update")
async def update_fee_structure(
    request: Request,
    structure_id: UUID,
    data: FeeStructureUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a fee structure."""
    result = await db.execute(
        select(FeeStructure).where(
            FeeStructure.id == structure_id,
            FeeStructure.tenant_id == current_user.tenant_id
        )
    )
    structure = result.scalar_one_or_none()
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Convert fee_components if present
    if "fee_components" in update_data and update_data["fee_components"] is not None:
        update_data["fee_components"] = [
            c.model_dump() if hasattr(c, 'model_dump') else c 
            for c in update_data["fee_components"]
        ]
    
    for field, value in update_data.items():
        setattr(structure, field, value)
    
    await db.commit()
    await db.refresh(structure)
    return structure


@router.delete("/{structure_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("fees", "delete")
async def delete_fee_structure(
    request: Request,
    structure_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a fee structure."""
    result = await db.execute(
        select(FeeStructure).where(
            FeeStructure.id == structure_id,
            FeeStructure.tenant_id == current_user.tenant_id
        )
    )
    structure = result.scalar_one_or_none()
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    
    await db.delete(structure)
    await db.commit()
    return None
