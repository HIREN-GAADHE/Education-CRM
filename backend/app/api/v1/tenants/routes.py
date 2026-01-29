from uuid import UUID
from fastapi import APIRouter, Request, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_db
from app.core.permissions import require_super_admin, require_tenant_admin
from app.core.security import security
from app.core.exceptions import TenantNotFoundException, ConflictException
from app.models import Tenant, TenantStatus, User, UserStatus, Role, RoleLevel
from app.schemas import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantListResponse,
    TenantSettingsUpdate,
    TenantBrandingUpdate,
    SlugCheckRequest,
    SlugCheckResponse,
    SuccessResponse,
    PublicTenantInfo,
)

router = APIRouter()


@router.get("/check-slug", response_model=SlugCheckResponse)
async def check_slug(
    slug: str = Query(..., min_length=2, max_length=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if a tenant slug is available.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug.lower())
    )
    existing = result.scalar_one_or_none()
    
    return SlugCheckResponse(
        slug=slug.lower(),
        available=existing is None
    )


@router.get("/public-info", response_model=PublicTenantInfo)
async def get_public_tenant_info(
    slug: str = Query(None, min_length=2, max_length=100),
    domain: str = Query(None, min_length=3, max_length=255),
    db: AsyncSession = Depends(get_db)
):
    """
    Get public tenant information for branding (unauthenticated).
    Query by 'slug' OR 'domain'.
    """
    if not slug and not domain:
        raise HTTPException(status_code=400, detail="Either slug or domain must be provided")

    query = select(Tenant)
    
    if domain:
        query = query.where(Tenant.domain == domain)
    else:
        query = query.where(Tenant.slug == slug.lower())
        
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise TenantNotFoundException(domain if domain else slug)
    
    return PublicTenantInfo(
        name=tenant.name,
        slug=tenant.slug,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
        secondary_color=tenant.secondary_color,
    )


from fastapi.responses import Response

@router.get("/{tenant_id}/logo")
async def get_tenant_logo(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get tenant logo (Public).
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant or not tenant.logo_binary:
        return Response(status_code=404)
    
    return Response(
        content=tenant.logo_binary,
        media_type=tenant.logo_content_type or "image/png"
    )


@router.get("", response_model=TenantListResponse)
@require_super_admin
async def list_tenants(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: TenantStatus = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all tenants (Super Admin only).
    """
    # Base query
    query = select(Tenant)
    count_query = select(func.count(Tenant.id))
    
    # Apply filters
    if status:
        query = query.where(Tenant.status == status)
        count_query = count_query.where(Tenant.status == status)
    
    # Get total
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Tenant.created_at.desc())
    
    result = await db.execute(query)
    tenants = result.scalars().all()
    
    return TenantListResponse(
        items=[TenantResponse.model_validate(t) for t in tenants],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(request: Request):
    """
    Get current tenant information.
    """
    tenant = request.state.tenant
    return TenantResponse.model_validate(tenant)


@router.get("/{tenant_id}", response_model=TenantResponse)
@require_super_admin
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific tenant (Super Admin only).
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise TenantNotFoundException(tenant_id)
    
    return TenantResponse.model_validate(tenant)


@router.post("", response_model=TenantResponse, status_code=201)
@require_super_admin
async def create_tenant(
    data: TenantCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new tenant with admin user (Super Admin only).
    """
    # Check if slug exists
    result = await db.execute(
        select(Tenant).where(Tenant.slug == data.slug.lower())
    )
    if result.scalar_one_or_none():
        raise ConflictException("Tenant slug already exists")
    
    # Create tenant
    tenant = Tenant(
        name=data.name,
        slug=data.slug.lower(),
        domain=data.domain,
        email=data.email,
        phone=data.phone,
        website=data.website,
        legal_name=data.legal_name,
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city,
        state=data.state,
        country=data.country,
        postal_code=data.postal_code,
        status=TenantStatus.ACTIVE
    )
    db.add(tenant)
    await db.flush()  # Get tenant ID
    
    # Create admin role for tenant
    admin_role = Role(
        tenant_id=tenant.id,
        name="UNIVERSITY_ADMIN",
        display_name="University Admin",
        description="Full access to all tenant resources",
        level=RoleLevel.UNIVERSITY_ADMIN.value,
        is_system_role=True,
        is_tenant_admin=True
    )
    db.add(admin_role)
    await db.flush()
    
    # Create admin user
    admin_user = User(
        tenant_id=tenant.id,
        email=data.admin_email,
        password_hash=security.hash_password(data.admin_password),
        first_name=data.admin_first_name,
        last_name=data.admin_last_name,
        status=UserStatus.ACTIVE,
        email_verified=True
    )
    db.add(admin_user)
    await db.flush()
    
    # Assign admin role to user
    from app.models import UserRole
    user_role = UserRole(
        user_id=admin_user.id,
        role_id=admin_role.id,
        is_primary=True
    )
    db.add(user_role)
    
    await db.commit()
    await db.refresh(tenant)
    
    return TenantResponse.model_validate(tenant)


@router.put("/current", response_model=TenantResponse)
@require_tenant_admin
async def update_current_tenant(
    request: Request,
    data: TenantUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update current tenant (Tenant Admin only).
    """
    tenant = request.state.tenant
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)
    
    await db.commit()
    await db.refresh(tenant)
    
    return TenantResponse.model_validate(tenant)


@router.put("/current/settings", response_model=SuccessResponse)
@require_tenant_admin
async def update_tenant_settings(
    request: Request,
    data: TenantSettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update tenant settings.
    """
    tenant = request.state.tenant
    
    # Merge settings
    current_settings = tenant.settings or {}
    current_settings.update(data.settings)
    tenant.settings = current_settings
    
    await db.commit()
    
    return SuccessResponse(success=True, message="Settings updated")


@router.put("/current/branding", response_model=TenantResponse)
@require_tenant_admin
async def update_tenant_branding(
    request: Request,
    data: TenantBrandingUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update tenant branding (logo, colors).
    """
    tenant = request.state.tenant
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)
    
    await db.commit()
    await db.refresh(tenant)
    
    return TenantResponse.model_validate(tenant)


@router.delete("/{tenant_id}", response_model=SuccessResponse)
@require_super_admin
async def delete_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a tenant (Super Admin only).
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise TenantNotFoundException(tenant_id)
    
    tenant.status = TenantStatus.INACTIVE
    await db.commit()
    
    return SuccessResponse(success=True, message="Tenant deactivated")
