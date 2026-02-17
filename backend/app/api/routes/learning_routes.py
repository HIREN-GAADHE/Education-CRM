from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db
from app.models.learning import LearningModule, LearningContent, ContentType
from app.models.user import User
from app.core.permissions import require_permission
from app.core.middleware.auth import get_current_user

router = APIRouter()

# --- Schemas ---

class LearningContentBase(BaseModel):
    title: str
    description: Optional[str] = None
    content_type: str = "video"
    content_url: str
    duration_seconds: Optional[int] = None
    order: Optional[int] = 0

class LearningContentResponse(LearningContentBase):
    id: UUID
    module_id: UUID
    
    class Config:
        from_attributes = True

class LearningModuleBase(BaseModel):
    title: str
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    category: Optional[str] = None
    is_published: Optional[bool] = True

class LearningModuleResponse(LearningModuleBase):
    id: UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    # We might want to return content count or duration here
    
    class Config:
        from_attributes = True

class LearningModuleDetailResponse(LearningModuleResponse):
    contents: List[LearningContentResponse] = []

# --- Endpoints ---

@router.get("/modules", response_model=List[LearningModuleResponse])
@require_permission("learning", "read")
async def list_modules(
    request: Request,
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all learning modules."""
    query = select(LearningModule).where(LearningModule.tenant_id == current_user.tenant_id)
    
    if search:
        query = query.where(LearningModule.title.ilike(f"%{search}%"))
    
    if category:
        query = query.where(LearningModule.category == category)
        
    query = query.order_by(desc(LearningModule.created_at))
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/modules/{module_id}", response_model=LearningModuleDetailResponse)
@require_permission("learning", "read")
async def get_module(
    request: Request,
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get module details with content."""
    query = select(LearningModule).where(
        LearningModule.id == module_id,
        LearningModule.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    module = result.scalar_one_or_none()
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
        
    # Lazy load contents explicitly if needed, but Pydantic should handle if relationship is loaded
    # To be safe and efficient with async, let's join or fetch separately. 
    # For now, relying on lazy loading might be tricky in async without explicit options.
    # Let's verify we load contents.
    content_query = select(LearningContent).where(
        LearningContent.module_id == module_id
    ).order_by(LearningContent.order)
    
    content_result = await db.execute(content_query)
    contents = content_result.scalars().all()
    
    # Construct response manually to ensure contents are attached
    return LearningModuleDetailResponse(
        **module.__dict__,
        contents=contents
    )

@router.post("/modules", response_model=LearningModuleResponse, status_code=status.HTTP_201_CREATED)
@require_permission("learning", "create")
async def create_module(
    request: Request,
    module_data: LearningModuleBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new learning module."""
    module = LearningModule(
        tenant_id=current_user.tenant_id,
        **module_data.model_dump()
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return module

@router.post("/modules/{module_id}/content", response_model=LearningContentResponse, status_code=status.HTTP_201_CREATED)
@require_permission("learning", "update")
async def add_content(
    request: Request,
    module_id: UUID,
    content_data: LearningContentBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add content to a module."""
    # Verify module exists
    query = select(LearningModule).where(
        LearningModule.id == module_id,
        LearningModule.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Module not found")

    content = LearningContent(
        tenant_id=current_user.tenant_id,
        module_id=module_id,
        title=content_data.title,
        description=content_data.description,
        content_type=ContentType(content_data.content_type),
        content_url=content_data.content_url,
        duration_seconds=content_data.duration_seconds,
        order=content_data.order
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)
    return content

@router.delete("/modules/{module_id}/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("learning", "update")
async def delete_content(
    request: Request,
    module_id: UUID,
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete content from a module."""
    result = await db.execute(
        select(LearningContent).where(
            LearningContent.id == content_id,
            LearningContent.module_id == module_id,
            LearningContent.tenant_id == current_user.tenant_id
        )
    )
    content = result.scalar_one_or_none()
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    await db.delete(content)
    await db.commit()
    return None

@router.put("/modules/{module_id}/content/{content_id}", response_model=LearningContentResponse)
@require_permission("learning", "update")
async def update_content(
    request: Request,
    module_id: UUID,
    content_id: UUID,
    content_data: LearningContentBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update content details."""
    result = await db.execute(
        select(LearningContent).where(
            LearningContent.id == content_id,
            LearningContent.module_id == module_id,
            LearningContent.tenant_id == current_user.tenant_id
        )
    )
    content = result.scalar_one_or_none()
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
        
    content.title = content_data.title
    content.description = content_data.description
    content.content_type = ContentType(content_data.content_type)
    content.content_url = content_data.content_url
    content.duration_seconds = content_data.duration_seconds
    if content_data.order is not None:
        content.order = content_data.order
    
    await db.commit()
    await db.refresh(content)
    return content
