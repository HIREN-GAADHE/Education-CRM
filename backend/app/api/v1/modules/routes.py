from uuid import UUID
from fastapi import APIRouter, Request, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_db
from app.core.permissions import require_permission, require_tenant_admin
from app.core.exceptions import NotFoundException, ForbiddenException
from app.models import Module, TenantModule, RoleModuleAccess, ModuleCategory, AccessLevel
from app.schemas import (
    ModuleResponse,
    ModuleListResponse,
    TenantModuleResponse,
    TenantModulesResponse,
    ModuleToggleRequest,
    ModuleSettingsUpdate,
    RoleModuleAccessRequest,
    RoleModuleAccessResponse,
    SuccessResponse,
)

router = APIRouter()


@router.get("", response_model=ModuleListResponse)
async def list_modules(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    List all available modules.
    """
    result = await db.execute(
        select(Module)
        .where(Module.is_active == True)
        .order_by(Module.category, Module.menu_order)
    )
    modules = result.scalars().all()
    
    # Group by category
    by_category = {}
    for mod in modules:
        cat = mod.category.value if mod.category else "other"
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(ModuleResponse.model_validate(mod))
    
    return ModuleListResponse(
        modules=[ModuleResponse.model_validate(m) for m in modules],
        by_category=by_category
    )


@router.get("/enabled", response_model=TenantModulesResponse)
async def list_tenant_modules(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    List modules enabled for current tenant.
    """
    tenant_id = request.state.tenant_id
    
    # Get enabled modules for tenant
    result = await db.execute(
        select(TenantModule)
        .where(TenantModule.tenant_id == tenant_id)
        .options(selectinload(TenantModule.module))
    )
    tenant_modules = result.scalars().all()
    
    enabled = []
    enabled_ids = set()
    for tm in tenant_modules:
        if tm.is_enabled:
            enabled.append(TenantModuleResponse(
                module_id=tm.module_id,
                module_code=tm.module.code,
                module_name=tm.module.name,
                is_enabled=tm.is_enabled,
                enabled_at=tm.enabled_at,
                usage_limit=tm.usage_limit,
                current_usage=tm.current_usage,
                settings=tm.settings or {}
            ))
            enabled_ids.add(tm.module_id)
    
    # Get available modules (not yet enabled)
    all_modules_result = await db.execute(
        select(Module).where(Module.is_active == True)
    )
    all_modules = all_modules_result.scalars().all()
    
    available = [
        ModuleResponse.model_validate(m)
        for m in all_modules
        if m.id not in enabled_ids
    ]
    
    return TenantModulesResponse(enabled=enabled, available=available)


@router.post("/toggle", response_model=SuccessResponse)
@require_tenant_admin
async def toggle_module(
    request: Request,
    data: ModuleToggleRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Enable or disable a module for the tenant.
    """
    tenant_id = request.state.tenant_id
    
    # Get module
    module_result = await db.execute(
        select(Module).where(Module.id == data.module_id)
    )
    module = module_result.scalar_one_or_none()
    
    if not module:
        raise NotFoundException("Module", data.module_id)
    
    if module.is_core and not data.enabled:
        raise ForbiddenException("Cannot disable core modules")
    
    # Get or create tenant module
    tm_result = await db.execute(
        select(TenantModule).where(
            TenantModule.tenant_id == tenant_id,
            TenantModule.module_id == data.module_id
        )
    )
    tenant_module = tm_result.scalar_one_or_none()
    
    if tenant_module:
        tenant_module.is_enabled = data.enabled
        if data.enabled:
            from datetime import datetime
            tenant_module.enabled_at = datetime.utcnow()
            tenant_module.disabled_at = None
        else:
            from datetime import datetime
            tenant_module.disabled_at = datetime.utcnow()
    else:
        from datetime import datetime
        tenant_module = TenantModule(
            tenant_id=tenant_id,
            module_id=data.module_id,
            is_enabled=data.enabled,
            enabled_at=datetime.utcnow() if data.enabled else None
        )
        db.add(tenant_module)
    
    await db.commit()
    
    action = "enabled" if data.enabled else "disabled"
    return SuccessResponse(success=True, message=f"Module {action}")


@router.put("/settings", response_model=SuccessResponse)
@require_tenant_admin
async def update_module_settings(
    request: Request,
    data: ModuleSettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update settings for a module.
    """
    tenant_id = request.state.tenant_id
    
    result = await db.execute(
        select(TenantModule).where(
            TenantModule.tenant_id == tenant_id,
            TenantModule.module_id == data.module_id
        )
    )
    tenant_module = result.scalar_one_or_none()
    
    if not tenant_module:
        raise NotFoundException("Module not enabled for tenant")
    
    # Merge settings
    current = tenant_module.settings or {}
    current.update(data.settings)
    tenant_module.settings = current
    
    await db.commit()
    
    return SuccessResponse(success=True, message="Module settings updated")


@router.post("/role-access", response_model=SuccessResponse)
@require_tenant_admin
async def set_role_module_access(
    request: Request,
    data: RoleModuleAccessRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Set a role's access level for a module.
    """
    # Check if existing access exists
    result = await db.execute(
        select(RoleModuleAccess).where(
            RoleModuleAccess.role_id == data.role_id,
            RoleModuleAccess.module_id == data.module_id
        )
    )
    access = result.scalar_one_or_none()
    
    if access:
        access.access_level = data.access_level
        access.allowed_actions = data.allowed_actions
        access.denied_actions = data.denied_actions
    else:
        access = RoleModuleAccess(
            role_id=data.role_id,
            module_id=data.module_id,
            access_level=data.access_level,
            allowed_actions=data.allowed_actions,
            denied_actions=data.denied_actions
        )
        db.add(access)
    
    await db.commit()
    
    return SuccessResponse(success=True, message="Role module access updated")


@router.get("/role-access/{role_id}")
@require_permission("roles", "read")
async def get_role_module_access(
    role_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a role's module access configuration.
    """
    result = await db.execute(
        select(RoleModuleAccess)
        .where(RoleModuleAccess.role_id == role_id)
        .options(selectinload(RoleModuleAccess.module))
    )
    access_list = result.scalars().all()
    
    return [
        RoleModuleAccessResponse(
            role_id=a.role_id,
            module_id=a.module_id,
            module_code=a.module.code,
            module_name=a.module.name,
            access_level=a.access_level,
            allowed_actions=a.allowed_actions or [],
            denied_actions=a.denied_actions or []
        )
        for a in access_list
    ]
