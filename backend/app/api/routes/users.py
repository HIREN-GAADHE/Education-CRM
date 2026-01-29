"""
User API Router - CRUD operations for users
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
import math

from app.config.database import get_db
from app.models import User, UserStatus, Role, UserRole
from app.core.security import security
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserListResponse,
    UserPasswordUpdate, UserRoleAssignment, RoleInfo
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all users with pagination and filtering."""
    query = select(User).options(selectinload(User.roles))
    
    # Apply filters
    if search:
        search_filter = or_(
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
    
    if status:
        query = query.where(User.status == status)
    
    # Get total count
    count_query = select(func.count(User.id))
    if search:
        count_query = count_query.where(search_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(User.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().unique().all()
    
    # Transform to response with roles
    user_responses = []
    for user in users:
        # Get roles for user
        roles_query = select(Role).join(UserRole).where(UserRole.user_id == user.id)
        roles_result = await db.execute(roles_query)
        roles = roles_result.scalars().all()
        
        user_dict = {
            "id": user.id,
            "tenant_id": user.tenant_id,
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "gender": user.gender,
            "status": user.status,
            "avatar_url": user.avatar_url,
            "email_verified": user.email_verified,
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "roles": [RoleInfo(id=r.id, name=r.name, display_name=r.display_name, level=r.level) for r in roles]
        }
        user_responses.append(UserResponse(**user_dict))
    
    return UserListResponse(
        items=user_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new user."""
    # Check for duplicate email
    existing = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Get tenant
    from app.models import Tenant
    tenant_result = await db.execute(select(Tenant).limit(1))
    tenant = tenant_result.scalar_one_or_none()
    
    # Create user
    user = User(
        tenant_id=tenant.id if tenant else None,
        email=user_data.email,
        username=user_data.username,
        password_hash=security.hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        gender=user_data.gender,
        status=user_data.status or UserStatus.ACTIVE,
        avatar_url=user_data.avatar_url,
    )
    
    db.add(user)
    await db.flush()
    
    # Assign roles if provided
    if user_data.role_ids:
        for role_id in user_data.role_ids:
            user_role = UserRole(user_id=user.id, role_id=role_id)
            db.add(user_role)
    
    await db.commit()
    await db.refresh(user)
    
    # Get roles for response
    roles_query = select(Role).join(UserRole).where(UserRole.user_id == user.id)
    roles_result = await db.execute(roles_query)
    roles = roles_result.scalars().all()
    
    return UserResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        gender=user.gender,
        status=user.status,
        avatar_url=user.avatar_url,
        email_verified=user.email_verified,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=[RoleInfo(id=r.id, name=r.name, display_name=r.display_name, level=r.level) for r in roles]
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single user by ID."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get roles
    roles_query = select(Role).join(UserRole).where(UserRole.user_id == user.id)
    roles_result = await db.execute(roles_query)
    roles = roles_result.scalars().all()
    
    return UserResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        gender=user.gender,
        status=user.status,
        avatar_url=user.avatar_url,
        email_verified=user.email_verified,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=[RoleInfo(id=r.id, name=r.name, display_name=r.display_name, level=r.level) for r in roles]
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a user."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    # Get roles
    roles_query = select(Role).join(UserRole).where(UserRole.user_id == user.id)
    roles_result = await db.execute(roles_query)
    roles = roles_result.scalars().all()
    
    return UserResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        gender=user.gender,
        status=user.status,
        avatar_url=user.avatar_url,
        email_verified=user.email_verified,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=[RoleInfo(id=r.id, name=r.name, display_name=r.display_name, level=r.level) for r in roles]
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a user."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete user roles first
    await db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user_id)
    )
    
    # Delete user
    await db.delete(user)
    await db.commit()
    
    return None


@router.put("/{user_id}/roles", response_model=UserResponse)
async def assign_roles(
    user_id: UUID,
    role_data: UserRoleAssignment,
    db: AsyncSession = Depends(get_db),
):
    """Assign roles to a user."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove existing roles
    await db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user_id)
    )
    
    # Add new roles
    for role_id in role_data.role_ids:
        user_role = UserRole(user_id=user.id, role_id=role_id)
        db.add(user_role)
    
    await db.commit()
    await db.refresh(user)
    
    # Get updated roles
    roles_query = select(Role).join(UserRole).where(UserRole.user_id == user.id)
    roles_result = await db.execute(roles_query)
    roles = roles_result.scalars().all()
    
    return UserResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        gender=user.gender,
        status=user.status,
        avatar_url=user.avatar_url,
        email_verified=user.email_verified,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=[RoleInfo(id=r.id, name=r.name, display_name=r.display_name, level=r.level) for r in roles]
    )
