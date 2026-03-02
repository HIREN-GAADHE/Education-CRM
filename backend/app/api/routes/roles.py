"""
Roles API Router - CRUD operations for roles with module access control
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db
from app.models import Role, Permission, RolePermission, RoleModuleAccess
from app.models.user import User
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission

router = APIRouter(prefix="/roles", tags=["Roles"])

# Available modules that can be assigned to roles (mirrors sidebar sections)
AVAILABLE_MODULES = [
    # ── Main ──────────────────────────────────────────────────────────────────
    {"key": "dashboard",     "name": "Dashboard",          "icon": "Dashboard",      "category": "Main"},
    {"key": "calendar",      "name": "Calendar",            "icon": "CalendarMonth",  "category": "Main"},

    # ── Academic ──────────────────────────────────────────────────────────────
    {"key": "students",      "name": "Classes & Students",  "icon": "School",         "category": "Academic"},
    {"key": "courses",       "name": "Courses",             "icon": "MenuBook",       "category": "Academic"},
    {"key": "attendance",    "name": "Attendance",          "icon": "EventNote",      "category": "Academic"},
    {"key": "timetable",     "name": "Timetable",           "icon": "Schedule",       "category": "Academic"},
    {"key": "examinations",  "name": "Examinations",        "icon": "Quiz",           "category": "Academic"},
    {"key": "certificates",  "name": "Certificates",        "icon": "CardMembership", "category": "Academic"},

    # ── Administration ────────────────────────────────────────────────────────
    {"key": "staff",         "name": "Staff",               "icon": "Badge",          "category": "Administration"},
    {"key": "payroll",       "name": "Payroll",             "icon": "AccountBalance", "category": "Administration"},
    {"key": "fees",          "name": "Fees & Finance",      "icon": "Payments",       "category": "Administration"},
    {"key": "payments",      "name": "Online Payments",     "icon": "CreditCard",     "category": "Administration"},
    {"key": "transport",     "name": "Transport",           "icon": "DirectionsBus",  "category": "Administration"},

    # ── Communication ─────────────────────────────────────────────────────────
    {"key": "communication", "name": "Messages",            "icon": "Chat",           "category": "Communication"},
    {"key": "reports",       "name": "Reports",             "icon": "Assessment",     "category": "Communication"},

    # ── Student Welfare ───────────────────────────────────────────────────────
    {"key": "health_records","name": "Health Records",      "icon": "HealthAndSafety","category": "Student Welfare"},
    {"key": "daily_diary",   "name": "Daily Diary",         "icon": "MenuBook",       "category": "Student Welfare"},
    {"key": "ptm",           "name": "Parent-Teacher Meet", "icon": "MeetingRoom",    "category": "Student Welfare"},
    {"key": "learning",      "name": "L&D Hub",             "icon": "School",         "category": "Student Welfare"},

    # ── System ────────────────────────────────────────────────────────────────
    {"key": "users",         "name": "Users",               "icon": "People",         "category": "System"},
    {"key": "roles",         "name": "Roles & Access",      "icon": "Security",       "category": "System"},
    {"key": "settings",      "name": "Settings",            "icon": "Settings",       "category": "System"},
]


class RoleBase(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    level: int = 3  # Keep for backwards compat, but not used in UI
    is_system_role: bool = False
    is_tenant_admin: bool = False
    is_default: bool = False
    icon: Optional[str] = "person"
    color: Optional[str] = "#666666"


class RoleCreate(RoleBase):
    permission_ids: Optional[List[UUID]] = None
    allowed_modules: List[str] = []  # List of module keys


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    is_default: Optional[bool] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    allowed_modules: Optional[List[str]] = None  # List of module keys


class PermissionResponse(BaseModel):
    id: UUID
    code: str
    display_name: str
    resource: str
    action: str
    category: Optional[str] = None
    
    class Config:
        from_attributes = True


class ModuleInfo(BaseModel):
    key: str
    name: str
    icon: str
    category: str


class RoleResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    name: str
    display_name: str
    description: Optional[str] = None
    level: int
    is_system_role: bool
    is_tenant_admin: bool
    is_default: bool
    icon: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    permissions: List[PermissionResponse] = []
    allowed_modules: List[str] = []  # List of module keys this role can access
    user_count: int = 0
    
    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    items: List[RoleResponse]
    total: int



@router.get("/metadata/modules", response_model=List[ModuleInfo])
async def get_available_modules(
    current_user: User = Depends(get_current_user),
):
    """Get list of available modules that can be assigned to roles."""
    return AVAILABLE_MODULES


@router.get("", response_model=RoleListResponse)
@require_permission("roles", "read")
async def list_roles(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all roles for the current tenant."""
    # Include system roles (tenant_id IS NULL) + tenant-specific roles
    result = await db.execute(
        select(Role).where(
            (Role.tenant_id == current_user.tenant_id) | (Role.tenant_id == None)
        ).order_by(Role.level)
    )
    roles = result.scalars().all()
    
    role_responses = []
    for role in roles:
        # Get permissions for role
        perms_query = select(Permission).join(RolePermission).where(RolePermission.role_id == role.id)
        perms_result = await db.execute(perms_query)
        permissions = perms_result.scalars().all()
        
        # Get allowed modules for role
        # Join RoleModuleAccess and Module to get the module codes
        from app.models import Module
        modules_query = (
            select(Module.code)
            .join(RoleModuleAccess, RoleModuleAccess.module_id == Module.id)
            .where(RoleModuleAccess.role_id == role.id)
        )
        modules_result = await db.execute(modules_query)
        allowed_modules = modules_result.scalars().all()
        
        # Get user count
        from app.models import UserRole
        count_result = await db.execute(
            select(func.count(UserRole.id)).where(UserRole.role_id == role.id)
        )
        user_count = count_result.scalar() or 0
        
        role_responses.append(RoleResponse(
            id=role.id,
            tenant_id=role.tenant_id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            level=role.level,
            is_system_role=role.is_system_role,
            is_tenant_admin=role.is_tenant_admin,
            is_default=role.is_default,
            icon=role.icon,
            color=role.color,
            created_at=role.created_at,
            updated_at=role.updated_at,
            permissions=[PermissionResponse(
                id=p.id, code=p.code, display_name=p.display_name or p.code,
                resource=p.resource, action=p.action, category=p.category
            ) for p in permissions],
            allowed_modules=allowed_modules,
            user_count=user_count,
        ))
    
    return RoleListResponse(items=role_responses, total=len(role_responses))


@router.get("/permissions", response_model=List[PermissionResponse])
@require_permission("roles", "read")
async def list_permissions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all available permissions."""
    result = await db.execute(select(Permission).order_by(Permission.category, Permission.code))
    permissions = result.scalars().all()
    return permissions


@router.get("/{role_id}", response_model=RoleResponse)
@require_permission("roles", "read")
async def get_role(
    request: Request,
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single role by ID (within current tenant or system roles)."""
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            (Role.tenant_id == current_user.tenant_id) | (Role.tenant_id == None)
        )
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Get permissions
    perms_query = select(Permission).join(RolePermission).where(RolePermission.role_id == role.id)
    perms_result = await db.execute(perms_query)
    permissions = perms_result.scalars().all()
    
    # Get allowed modules
    from app.models import Module
    modules_query = (
        select(Module.code)
        .join(RoleModuleAccess, RoleModuleAccess.module_id == Module.id)
        .where(RoleModuleAccess.role_id == role.id)
    )
    modules_result = await db.execute(modules_query)
    allowed_modules = modules_result.scalars().all()
    
    # Get user count
    from app.models import UserRole
    count_result = await db.execute(
        select(func.count(UserRole.id)).where(UserRole.role_id == role.id)
    )
    user_count = count_result.scalar() or 0
    
    return RoleResponse(
        id=role.id,
        tenant_id=role.tenant_id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        is_system_role=role.is_system_role,
        is_tenant_admin=role.is_tenant_admin,
        is_default=role.is_default,
        icon=role.icon,
        color=role.color,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=[PermissionResponse(
            id=p.id, code=p.code, display_name=p.display_name or p.code,
            resource=p.resource, action=p.action, category=p.category
        ) for p in permissions],
        allowed_modules=allowed_modules,
        user_count=user_count,
    )


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
@require_permission("roles", "create")
async def create_role(
    request: Request,
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new role for the current tenant."""
    role = Role(
        tenant_id=current_user.tenant_id,  # Scoped to current tenant
        name=role_data.name,
        display_name=role_data.display_name,
        description=role_data.description,
        level=role_data.level,
        is_system_role=role_data.is_system_role,
        is_tenant_admin=role_data.is_tenant_admin,
        is_default=role_data.is_default,
        icon=role_data.icon,
        color=role_data.color,
    )
    
    db.add(role)
    await db.flush()
    
    # Assign permissions
    if role_data.permission_ids:
        for perm_id in role_data.permission_ids:
            rp = RolePermission(role_id=role.id, permission_id=perm_id, granted=True)
            db.add(rp)
            
    # Assign module access
    if role_data.allowed_modules:
        from app.models import Module, AccessLevel
        # Find specified modules
        modules_result = await db.execute(
            select(Module).where(Module.code.in_(role_data.allowed_modules))
        )
        modules = modules_result.scalars().all()
        
        for module in modules:
            rma = RoleModuleAccess(
                role_id=role.id,
                module_id=module.id,
                access_level=AccessLevel.FULL
            )
            db.add(rma)
    
    await db.commit()
    await db.refresh(role)
    
    # Return mapping handled by get_role logic, reusing manual construction here for efficiency
    # But need to return the list we just saved
    return RoleResponse(
        id=role.id,
        tenant_id=role.tenant_id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        is_system_role=role.is_system_role,
        is_tenant_admin=role.is_tenant_admin,
        is_default=role.is_default,
        icon=role.icon,
        color=role.color,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=[],
        allowed_modules=role_data.allowed_modules,
        user_count=0,
    )


@router.put("/{role_id}", response_model=RoleResponse)
@require_permission("roles", "update")
async def update_role(
    request: Request,
    role_id: UUID,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a role (within current tenant)."""
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            Role.tenant_id == current_user.tenant_id,
        )
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot modify system roles")
    
    # Update fields
    update_data = role_data.model_dump(exclude_unset=True)
    # Remove allowed_modules from update_data as it's handled separately
    if 'allowed_modules' in update_data:
        del update_data['allowed_modules']
        
    for field, value in update_data.items():
        setattr(role, field, value)
        
    # Update module access if provided
    if role_data.allowed_modules is not None:
        # Remove existing access
        await db.execute(
            delete(RoleModuleAccess).where(RoleModuleAccess.role_id == role.id)
        )
        
        # Add new access
        if role_data.allowed_modules:
            from app.models import Module, AccessLevel
            modules_result = await db.execute(
                select(Module).where(Module.code.in_(role_data.allowed_modules))
            )
            modules = modules_result.scalars().all()
            
            for module in modules:
                rma = RoleModuleAccess(
                    role_id=role.id,
                    module_id=module.id,
                    access_level=AccessLevel.FULL
                )
                db.add(rma)
    
    await db.commit()
    await db.refresh(role)
    
    return await get_role(role_id, db)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("roles", "delete")
async def delete_role(
    request: Request,
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a role (within current tenant only)."""
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            Role.tenant_id == current_user.tenant_id,  # Can't delete system/other-tenant roles
        )
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Delete role permissions
    await db.execute(RolePermission.__table__.delete().where(RolePermission.role_id == role_id))
    
    # Delete module access
    await db.execute(RoleModuleAccess.__table__.delete().where(RoleModuleAccess.role_id == role_id))
    
    # Delete role
    await db.delete(role)
    await db.commit()
    
    return None
