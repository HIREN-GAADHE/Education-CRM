from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Request, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_db
from app.core.permissions import require_permission
from app.core.security import security
from app.core.exceptions import UserNotFoundException, EmailAlreadyExistsException, ForbiddenException
from app.models import User, UserStatus, UserRole, ParentStudent, Student
from app.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    AssignRoleRequest,
    SuccessResponse,
)

router = APIRouter()


@router.get("", response_model=UserListResponse)
@require_permission("users", "read")
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[UserStatus] = None,
    class_id: Optional[UUID] = None, # Added filter
    db: AsyncSession = Depends(get_db)
):
    """
    List all users in the tenant with pagination.
    """
    tenant_id = request.state.tenant_id
    
    # Base query
    query = select(User).where(User.tenant_id == tenant_id)
    count_query = select(func.count(User.id)).where(User.tenant_id == tenant_id)
    
    # Optional Class Filter (finds parents of students in class)
    if class_id:
        # Join ParentStudent -> Student
        query = query.join(ParentStudent, ParentStudent.parent_user_id == User.id)\
                     .join(Student, Student.id == ParentStudent.student_id)\
                     .where(Student.class_id == class_id)
        
        count_query = count_query.join(ParentStudent, ParentStudent.parent_user_id == User.id)\
                                 .join(Student, Student.id == ParentStudent.student_id)\
                                 .where(Student.class_id == class_id)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (User.email.ilike(search_filter)) |
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter))
        )
        count_query = count_query.where(
            (User.email.ilike(search_filter)) |
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter))
        )
    
    if status:
        query = query.where(User.status == status)
        count_query = count_query.where(User.status == status)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    query = query.options(selectinload(User.roles))
    
    # Execute query
    result = await db.execute(query)
    users = result.scalars().all()
    
    return UserListResponse(
        items=[_user_to_response(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(request: Request):
    """
    Get current authenticated user.
    """
    user = request.state.user
    return _user_to_response(user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    request: Request,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update current authenticated user's profile.
    """
    user_id = request.state.user_id
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UserNotFoundException(user_id)
    
    # Update allowed fields only (not roles, status, etc.)
    allowed_fields = ['first_name', 'middle_name', 'last_name', 'phone', 'date_of_birth', 'gender', 'avatar_url']
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field in allowed_fields:
            setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return _user_to_response(user)


from pydantic import BaseModel as PydanticBaseModel

class ChangePasswordRequest(PydanticBaseModel):
    current_password: str
    new_password: str


@router.post("/me/change-password")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Change current user's password.
    """
    user_id = request.state.user_id
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise UserNotFoundException(user_id)
    
    # Verify current password
    if not security.verify_password(data.current_password, user.password_hash):
        raise ForbiddenException("Current password is incorrect")
    
    # Validate new password strength
    is_valid, errors = security.validate_password_strength(data.new_password)
    if not is_valid:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0] if errors else "Password does not meet requirements"
        )
    
    # Update password
    user.password_hash = security.hash_password(data.new_password)
    await db.commit()
    
    return {"success": True, "message": "Password changed successfully"}


@router.get("/{user_id}", response_model=UserResponse)
@require_permission("users", "read")
async def get_user(
    request: Request,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific user by ID.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(User)
        .where(User.id == user_id, User.tenant_id == tenant_id)
        .options(selectinload(User.roles))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise UserNotFoundException(user_id)
    
    return _user_to_response(user)


@router.post("", response_model=UserResponse, status_code=201)
@require_permission("users", "create")
async def create_user(
    request: Request,
    data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user.
    """
    tenant_id = request.state.tenant_id
    
    # Check if email already exists
    existing = await db.execute(
        select(User).where(
            User.email == data.email,
            User.tenant_id == tenant_id
        )
    )
    if existing.scalar_one_or_none():
        raise EmailAlreadyExistsException()
    
    # Create user
    user = User(
        tenant_id=tenant_id,
        email=data.email,
        password_hash=security.hash_password(data.password),
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        phone=data.phone,
        username=data.username,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        status=UserStatus.ACTIVE
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Assign roles if provided
    if data.role_ids:
        for role_id in data.role_ids:
            user_role = UserRole(
                user_id=user.id,
                role_id=role_id,
                assigned_by=request.state.user_id
            )
            db.add(user_role)
        await db.commit()
    
    return _user_to_response(user)


@router.put("/{user_id}", response_model=UserResponse)
@require_permission("users", "update")
async def update_user(
    request: Request,
    user_id: UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a user.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise UserNotFoundException(user_id)
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return _user_to_response(user)


@router.delete("/{user_id}", response_model=SuccessResponse)
@require_permission("users", "delete")
async def delete_user(
    request: Request,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a user (soft delete).
    """
    tenant_id = request.state.tenant_id
    current_user_id = request.state.user_id
    
    # Prevent self-deletion
    if str(user_id) == str(current_user_id):
        raise ForbiddenException("Cannot delete your own account")
    
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise UserNotFoundException(user_id)
    
    # Soft delete
    user.status = UserStatus.INACTIVE
    await db.commit()
    
    return SuccessResponse(success=True, message="User deleted successfully")


@router.post("/{user_id}/roles", response_model=SuccessResponse)
@require_permission("roles", "assign")
async def assign_roles(
    request: Request,
    user_id: UUID,
    data: AssignRoleRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Assign roles to a user.
    """
    tenant_id = request.state.tenant_id
    
    # Verify user exists
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise UserNotFoundException(user_id)
    
    # Remove existing roles
    await db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user_id)
    )
    
    # Add new roles
    for role_id in data.role_ids:
        user_role = UserRole(
            user_id=user_id,
            role_id=role_id,
            scope_type=data.scope_type,
            scope_id=data.scope_id,
            assigned_by=request.state.user_id
        )
        db.add(user_role)
    
    await db.commit()
    
    return SuccessResponse(success=True, message="Roles assigned successfully")


def _user_to_response(user: User) -> UserResponse:
    """Convert User model to UserResponse schema."""
    roles = []
    # Safely access roles - avoid triggering lazy load in async context
    try:
        if hasattr(user, 'roles') and user.roles is not None:
            # Check if roles are already loaded (not a lazy proxy)
            from sqlalchemy.orm import object_session
            if object_session(user) is None or 'roles' in user.__dict__:
                for ur in user.roles:
                    if hasattr(ur, 'role') and ur.role:
                        roles.append({
                            "id": ur.role.id,
                            "name": ur.role.name,
                            "display_name": ur.role.display_name,
                            "level": ur.role.level
                        })
    except Exception:
        # If accessing roles fails (lazy load in async), just return empty list
        pass
    
    return UserResponse(
        id=user.id,
        tenant_id=getattr(user, 'tenant_id', None),
        email=user.email,
        first_name=user.first_name,
        middle_name=getattr(user, 'middle_name', None),
        last_name=user.last_name,
        full_name=getattr(user, 'full_name', None),
        phone=getattr(user, 'phone', None),
        avatar_url=getattr(user, 'avatar_url', None),
        status=user.status,
        email_verified=getattr(user, 'email_verified', False),
        roles=roles,
        created_at=getattr(user, 'created_at', None),
        updated_at=getattr(user, 'updated_at', None),
    )
