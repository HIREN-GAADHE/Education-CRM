from uuid import UUID
from fastapi import APIRouter, Request, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_db
from app.core.permissions import require_permission, require_tenant_admin
from app.core.exceptions import NotFoundException, ForbiddenException
from app.models import Role, RoleLevel, Permission, RolePermission
from app.models.module import RoleModuleAccess, AccessLevel
from app.schemas import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
    PermissionResponse,
    PermissionListResponse,
    RolePermissionUpdate,
    SuccessResponse,
)
from app.schemas.role import ModuleAccessResponse, ModuleInfo
from typing import List

router = APIRouter()

AVAILABLE_MODULES = [
    {"key": "dashboard", "name": "Dashboard", "icon": "Dashboard", "category": "Core"},
    {"key": "calendar", "name": "Calendar", "icon": "CalendarMonth", "category": "Core"},
    {"key": "students", "name": "Students", "icon": "School", "category": "Academic"},
    {"key": "courses", "name": "Courses", "icon": "MenuBook", "category": "Academic"},
    {"key": "attendance", "name": "Attendance", "icon": "EventNote", "category": "Academic"},
    {"key": "timetable", "name": "Timetable", "icon": "Schedule", "category": "Academic"},
    {"key": "examinations", "name": "Examinations", "icon": "Quiz", "category": "Academic"},
    {"key": "certificates", "name": "Certificates", "icon": "CardMembership", "category": "Academic"},
    {"key": "staff", "name": "Staff", "icon": "Badge", "category": "Administrative"},
    {"key": "fees", "name": "Fees & Finance", "icon": "Payments", "category": "Finance"},
    {"key": "payments", "name": "Online Payments", "icon": "CreditCard", "category": "Finance"},
    {"key": "communication", "name": "Messages", "icon": "Chat", "category": "Communication"},
    {"key": "reports", "name": "Reports", "icon": "Assessment", "category": "Analytics"},
    {"key": "transport", "name": "Transport", "icon": "DirectionsBus", "category": "Services"},
    {"key": "users", "name": "Users", "icon": "People", "category": "System"},
    {"key": "roles", "name": "Roles & Access", "icon": "Security", "category": "System"},
    {"key": "settings", "name": "Settings", "icon": "Settings", "category": "System"},
    {"key": "marketplace", "name": "Marketplace", "icon": "Storefront", "category": "Services"},
]


@router.get("/metadata/modules", response_model=List[ModuleInfo])
async def get_available_modules():
    """Get list of available modules that can be assigned to roles."""
    return AVAILABLE_MODULES


@router.get("", response_model=RoleListResponse)
@require_permission("roles", "read")
async def list_roles(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    List all roles in the tenant.
    """
    print("DEBUG: Executing list_roles from app/api/v1/roles/routes.py (CORRECT FILE)")
    tenant_id = request.state.tenant_id
    user_role_level = getattr(request.state, 'role_level', 4)
    
    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Listing roles for tenant_id: {tenant_id}, user_role_level: {user_role_level}")
    
    # Query only roles belonging to this tenant (filter out system level 0 roles - super admin only)
    result = await db.execute(
        select(Role).where(
            Role.tenant_id == tenant_id,
            Role.is_active == True  # Only active roles
        ).where(
            Role.level >= user_role_level  # Can only see roles at or below their level
        ).where(
            Role.level > 0  # Don't show super admin role (level 0) to tenant users
        ).order_by(Role.level)
    )
    roles = result.scalars().all()
    
    logger.info(f"Found {len(roles)} roles for tenant: {tenant_id}")

    
    # Build response with permissions and user counts
    from sqlalchemy import func
    from app.models import UserRole
    from app.models.module import Module
    
    role_responses = []
    for role in roles:
        # Get user count for this role
        user_count_result = await db.scalar(
            select(func.count(UserRole.id)).where(UserRole.role_id == role.id)
        )
        
        # Get permissions for this role (fetch from RolePermission join)
        perm_result = await db.execute(
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role.id)
            .where(RolePermission.granted == True)
        )
        permissions = [PermissionResponse.model_validate(p) for p in perm_result.scalars().all()]
        
        # Get allowed modules for role
        modules_query = (
            select(Module.code)
            .join(RoleModuleAccess, RoleModuleAccess.module_id == Module.id)
            .where(RoleModuleAccess.role_id == role.id)
        )
        modules_result = await db.execute(modules_query)
        allowed_modules = modules_result.scalars().all()
        
        role_data = {
            "id": role.id,
            "name": role.name,
            "display_name": role.display_name,
            "description": role.description,
            "level": role.level or 99,
            "is_system_role": role.is_system_role,
            "is_tenant_admin": role.is_tenant_admin,
            "is_default": role.is_default,
            "is_active": role.is_active,
            "icon": role.icon,
            "color": role.color,
            "parent_role_id": role.parent_role_id,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
            "permissions": permissions,
            "allowed_modules": allowed_modules,
            "user_count": user_count_result or 0
        }
        role_responses.append(RoleResponse(**role_data))

    
    return RoleListResponse(
        items=role_responses,
        total=len(role_responses)
    )


@router.get("/permissions", response_model=PermissionListResponse)
@require_permission("roles", "read")
async def list_permissions(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    List all available permissions grouped by category.
    """
    result = await db.execute(select(Permission).order_by(Permission.category, Permission.resource))
    permissions = result.scalars().all()
    
    # Group by category
    categories = {}
    for perm in permissions:
        cat = perm.category or "Other"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(PermissionResponse.model_validate(perm))
    
    return PermissionListResponse(categories=categories)


@router.get("/{role_id}", response_model=RoleResponse)
@require_permission("roles", "read")
async def get_role(
    role_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific role with its permissions.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            (Role.tenant_id == tenant_id) | (Role.is_system_role == True)
        ).options(selectinload(Role.permissions))
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise NotFoundException("Role", role_id)
    
    # Get allowed modules
    from app.models.module import Module
    modules_query = (
        select(Module.code)
        .join(RoleModuleAccess, RoleModuleAccess.module_id == Module.id)
        .where(RoleModuleAccess.role_id == role.id)
    )
    modules_result = await db.execute(modules_query)
    allowed_modules = modules_result.scalars().all()
    
    role.allowed_modules = allowed_modules # Manually attach
    
    return RoleResponse.model_validate(role)


@router.post("", response_model=RoleResponse, status_code=201)
@require_tenant_admin
async def create_role(
    request: Request,
    data: RoleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new custom role.
    """
    tenant_id = request.state.tenant_id
    user_role_level = getattr(request.state, 'role_level', 4)
    
    # Cannot create role with higher privilege than own
    if data.level < user_role_level:
        raise ForbiddenException("Cannot create role with higher privilege than your own")
    
    # Create role
    role = Role(
        tenant_id=tenant_id,
        name=data.name.upper().replace(" ", "_"),
        display_name=data.display_name,
        description=data.description,
        level=data.level,
        parent_role_id=data.parent_role_id,
        icon=data.icon,
        color=data.color,
        is_system_role=False,
        is_active=True
    )
    db.add(role)
    await db.flush()
    
    # Assign permissions
    permissions = []
    if data.permission_ids:
        for perm_id in data.permission_ids:
            rp = RolePermission(
                role_id=role.id,
                permission_id=perm_id,
                granted=True,
                granted_by=request.state.user_id
            )
            db.add(rp)
            # Fetch the permission for response
            perm_result = await db.execute(select(Permission).where(Permission.id == perm_id))
            perm = perm_result.scalar_one_or_none()
            if perm:
                permissions.append(PermissionResponse.model_validate(perm))
    
    # Save module access
    from app.models.module import Module
    allowed_modules = []
    if data.allowed_modules:
        for mod_key in data.allowed_modules:
            # Get module ID from module_key (code)
            module_result = await db.execute(
                select(Module).where(Module.code == mod_key)
            )
            module = module_result.scalar_one_or_none()
            if module:
                rma = RoleModuleAccess(
                    role_id=role.id,
                    module_id=module.id,
                    access_level=AccessLevel.FULL # Default to FULL for now
                )
                db.add(rma)
                allowed_modules.append(mod_key)
    
    await db.commit()
    await db.refresh(role)
    
    # Build response manually
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        is_system_role=role.is_system_role,
        is_tenant_admin=role.is_tenant_admin,
        is_default=role.is_default,
        is_active=role.is_active,
        icon=role.icon,
        color=role.color,
        parent_role_id=role.parent_role_id,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=permissions,
        allowed_modules=allowed_modules,
        user_count=0
    )


@router.put("/{role_id}", response_model=RoleResponse)
@require_tenant_admin
async def update_role(
    role_id: UUID,
    request: Request,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a custom role.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.tenant_id == tenant_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise NotFoundException("Role", role_id)
    
    if role.is_system_role:
        raise ForbiddenException("Cannot modify system roles")
    
    update_data = data.model_dump(exclude_unset=True)
    # Handle allowed_modules separately
    allowed_modules_data = update_data.pop('allowed_modules', None)
    
    for field, value in update_data.items():
        setattr(role, field, value)
        
    # Update module access if provided
    if allowed_modules_data is not None:
        # Delete existing
        await db.execute(
            RoleModuleAccess.__table__.delete().where(RoleModuleAccess.role_id == role.id)
        )
        # Add new
        from app.models.module import Module
        current_modules = []
        for mod_key in allowed_modules_data:
            module_result = await db.execute(
                select(Module).where(Module.code == mod_key)
            )
            module = module_result.scalar_one_or_none()
            if module:
                rma = RoleModuleAccess(
                    role_id=role.id,
                    module_id=module.id,
                    access_level=AccessLevel.FULL
                )
                db.add(rma)
                current_modules.append(mod_key)
        
        # We need to pass this to response
        role.allowed_modules = current_modules
    else:
        # Load existing modules
        from app.models.module import Module
        modules_query = (
            select(Module.code)
            .join(RoleModuleAccess, RoleModuleAccess.module_id == Module.id)
            .where(RoleModuleAccess.role_id == role.id)
        )
        modules_result = await db.execute(modules_query)
        role.allowed_modules = modules_result.scalars().all()
    
    await db.commit()
    await db.refresh(role)
    
    # Fetch permissions and user count separately
    from sqlalchemy import func
    from app.models import UserRole as UserRoleModel
    
    user_count = await db.scalar(
        select(func.count(UserRoleModel.id)).where(UserRoleModel.role_id == role.id)
    )
    
    perm_result = await db.execute(
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role.id)
        .where(RolePermission.granted == True)
    )
    permissions = [PermissionResponse.model_validate(p) for p in perm_result.scalars().all()]
    
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        is_system_role=role.is_system_role,
        is_tenant_admin=role.is_tenant_admin,
        is_default=role.is_default,
        is_active=role.is_active,
        icon=role.icon,
        color=role.color,
        parent_role_id=role.parent_role_id,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=permissions,
        allowed_modules=role.allowed_modules,
        user_count=user_count or 0
    )


@router.put("/{role_id}/permissions", response_model=SuccessResponse)
@require_tenant_admin
async def update_role_permissions(
    role_id: UUID,
    request: Request,
    data: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update permissions for a role.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.tenant_id == tenant_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise NotFoundException("Role", role_id)
    
    if role.is_system_role:
        raise ForbiddenException("Cannot modify system role permissions")
    
    # Remove existing permissions
    await db.execute(
        RolePermission.__table__.delete().where(RolePermission.role_id == role_id)
    )
    
    # Add new permissions
    for perm_id in data.permission_ids:
        rp = RolePermission(
            role_id=role_id,
            permission_id=perm_id,
            granted=True,
            granted_by=request.state.user_id
        )
        db.add(rp)
    
    await db.commit()
    
    return SuccessResponse(success=True, message="Permissions updated")


@router.delete("/{role_id}", response_model=SuccessResponse)
@require_tenant_admin
async def delete_role(
    role_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a custom role.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.tenant_id == tenant_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise NotFoundException("Role", role_id)
    
    if role.is_system_role:
        raise ForbiddenException("Cannot delete system roles")
    
    # Delete RoleModuleAccess
    await db.execute(
        RoleModuleAccess.__table__.delete().where(RoleModuleAccess.role_id == role.id)
    )
    
    # Soft delete by deactivating
    role.is_active = False
    await db.commit()
    
    return SuccessResponse(success=True, message="Role deleted")
