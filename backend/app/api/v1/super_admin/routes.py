from datetime import datetime
from uuid import uuid4
from typing import List
from fastapi import APIRouter, Request, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, func, update, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_db
from app.core.permissions import require_super_admin
from app.core.security import security
from app.models import User, Tenant, TenantStatus, Role, RoleLevel, UserRole, UserStatus
from app.api.v1.super_admin.schemas import (
    SuperAdminTenantCreate,
    SuperAdminTenantUpdate,
    TenantStats,
    TenantDetail,
    TenantAnalytics,
    GlobalStats,
    TenantAdminAction
)

router = APIRouter()

@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
@require_super_admin
async def get_tenant_detail(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Get full details for a specific university.
    """
    # Query Tenant with user count
    stmt = (
        select(
            Tenant,
            func.count(User.id).label("total_users")
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .where(Tenant.id == tenant_id)
        .group_by(Tenant.id)
    )
    
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="University not found")
        
    tenant, user_count = row
    
    return TenantDetail(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        created_at=tenant.created_at,
        restricted_modules=tenant.restricted_modules or [],
        total_users=user_count,
        email=tenant.email,
        phone=tenant.phone,
        address=tenant.address_line1, # Map DB address_line1 to schema address
        city=tenant.city,
        country=tenant.country,
        plan_id=tenant.plan_id,
        features=tenant.features,
        logo_url=tenant.logo_url
    )

# ... (keep existing router definition) ...

@router.post("/tenants/{tenant_id}/logo", response_model=dict)
@require_super_admin
async def upload_tenant_logo(
    tenant_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a logo for a specific university (tenant).
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image"
        )
    
    # Save file to DB
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
        
    # Update Tenant
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
    
    tenant.logo_binary = content
    tenant.logo_content_type = file.content_type
    
    # Use API route for logo
    # NOTE: In production, you might want to version this or use a cache busting query param
    logo_url = f"/api/v1/tenants/{tenant_id}/logo"
    tenant.logo_url = logo_url
    
    await db.commit()
    
    await db.commit()
    
    return {"message": "Logo uploaded successfully", "logo_url": logo_url}

@router.delete("/tenants/{tenant_id}/logo", status_code=204)
@require_super_admin
async def delete_tenant_logo(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Remove tenant logo.
    """
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
    
    tenant.logo_binary = None
    tenant.logo_content_type = None
    tenant.logo_url = None
    
    await db.commit()
    
    return None

@router.post("/tenants/{tenant_id}/admin", response_model=dict)
@require_super_admin
async def manage_tenant_admin(
    tenant_id: str,
    data: TenantAdminAction,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Create or reset a University Admin for a tenant.
    """
    # Verify tenant
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
        
    # Check if this user exists in this tenant
    stmt = select(User).where(
        User.tenant_id == tenant_id,
        User.email == data.email
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    hashed_pwd = security.hash_password(data.password)
    
    if user:
        # Update existing user
        user.password_hash = hashed_pwd
        user.first_name = data.first_name
        user.last_name = data.last_name
        user.status = UserStatus.ACTIVE # Re-activate if needed
        db.add(user)
        
        # Ensure they have admin role
        # Find University Admin role
        role_stmt = select(Role).where(
            Role.tenant_id == tenant_id,
            Role.level == RoleLevel.UNIVERSITY_ADMIN.value
        )
        role_res = await db.execute(role_stmt)
        admin_role = role_res.scalar_one_or_none()
        
        if admin_role:
            # Check assignment
            ass_stmt = select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role_id == admin_role.id
            )
            ass_res = await db.execute(ass_stmt)
            if not ass_res.scalar_one_or_none():
                # Assign
                ur = UserRole(
                    user_id=user.id,
                    role_id=admin_role.id,
                    assigned_by=request.state.user_id,
                    is_primary=True
                )
                db.add(ur)
    else:
        # Create new user
        user = User(
            tenant_id=tenant_id,
            email=data.email,
            password_hash=hashed_pwd,
            first_name=data.first_name,
            last_name=data.last_name,
            status=UserStatus.ACTIVE,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        
        # Assign Admin Role
        role_stmt = select(Role).where(
            Role.tenant_id == tenant_id,
            Role.level == RoleLevel.UNIVERSITY_ADMIN.value
        )
        role_res = await db.execute(role_stmt)
        admin_role = role_res.scalar_one_or_none()
        
        if admin_role:
            ur = UserRole(
                user_id=user.id,
                role_id=admin_role.id,
                assigned_by=request.state.user_id,
                is_primary=True
            )
            db.add(ur)
        else:
            # Fallback if role missing (should not happen if tenant created correctly)
            raise HTTPException(status_code=500, detail="University Admin role missing for this tenant")

    await db.commit()
    
    return {"message": "Administrator updated successfully", "email": data.email}

@router.post("/tenants", response_model=TenantStats, status_code=201)
@require_super_admin
async def create_tenant(
    request: Request,
    data: SuperAdminTenantCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new university (tenant) and its initial administrator.
    """
    import re
    
    # Validate slug format (lowercase alphanumeric with hyphens only)
    slug_pattern = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$')
    if not slug_pattern.match(data.slug) or len(data.slug) < 2 or len(data.slug) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug must be 2-50 characters, lowercase, alphanumeric with hyphens only, and cannot start/end with hyphen."
        )
    
    # Reserved slugs that could conflict with routes
    reserved_slugs = ['admin', 'api', 'www', 'app', 'login', 'dashboard', 'super-admin', 'superadmin']
    if data.slug.lower() in reserved_slugs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{data.slug}' is a reserved URL and cannot be used."
        )
    
    # Validate admin password strength
    is_valid, errors = security.validate_password_strength(data.admin_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password too weak: {errors[0]}"
        )
    
    # Check if slug exists
    existing = await db.execute(select(Tenant).where(Tenant.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"University URL '{data.slug}' is already taken."
        )
    
    # Check if admin email exists globally (optional, but good practice)
    # user_exists = await db.execute(select(User).where(User.email == data.admin_email))
    # if user_exists.scalar_one_or_none():
    #     raise HTTPException(
    #         status_code=400,
    #         detail="Admin email already registered in system."
    #     )

    try:
        # 1. Create Tenant
        tenant = Tenant(
            name=data.name,
            slug=data.slug,
            domain=data.domain if data.domain else None,
            email=data.email,
            status=TenantStatus.ACTIVE,
            plan_id=data.plan_id,
            features=data.features,
            phone=data.phone,
            address_line1=data.address,
            city=data.city,
            country=data.country
        )
        db.add(tenant)
        await db.flush() # Get ID
        
        # 2. Create University Admin Role for this tenant
        admin_role = Role(
            tenant_id=tenant.id,
            name="University Administrator",
            display_name="University Admin",
            description="Full access to university management",
            level=RoleLevel.UNIVERSITY_ADMIN.value,
            is_system_role=True,
            is_tenant_admin=True,
            is_active=True
        )
        db.add(admin_role)
        await db.flush()
        
        # 3. Create Default Roles (optional, typically done by seed or trigger)
        # Create Staff Role
        staff_role = Role(
            tenant_id=tenant.id,
            name="staff",
            display_name="Staff",
            level=RoleLevel.STAFF.value,
            is_system_role=True
        )
        # Create User/Student Role
        user_role_def = Role(
            tenant_id=tenant.id,
            name="student",
            display_name="Student",
            level=RoleLevel.USER.value,
            is_system_role=True,
            is_default=True
        )
        db.add(staff_role)
        db.add(user_role_def)
        
        # 4. Create Admin User
        admin_user = User(
            tenant_id=tenant.id,
            email=data.admin_email,
            password_hash=security.hash_password(data.admin_password),
            first_name=data.admin_first_name,
            last_name=data.admin_last_name,
            status=UserStatus.ACTIVE,
            email_verified=True,
        )
        db.add(admin_user)
        await db.flush()
        
        # 5. Assign Role
        user_role = UserRole(
            user_id=admin_user.id,
            role_id=admin_role.id,
            assigned_by=request.state.user_id,
            is_primary=True
        )
        db.add(user_role)
        
        await db.commit()
        await db.refresh(tenant)
        
        # Return basic stats (all 0 except users=1)
        return TenantStats(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status.value,
            created_at=tenant.created_at,
            total_users=1,
            total_staff=1, # Admin counts as staff usually
            logo_url=tenant.logo_url
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create university: {str(e)}"
        )

@router.get("/tenants", response_model=List[TenantStats])
@require_super_admin
async def list_tenants(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    List all universities with high-level statistics.
    Advanced aggregation query to fetch counts properly.
    """
    # Query Tenants with aggregated counts
    # Subquery for user counts
    stmt = (
        select(
            Tenant,
            func.count(User.id).label("total_users"),
            # Count staff (role level <= 3) roughly, or just total users
            # For robust counting we might need to join UserRole -> Role but that's expensive for list
            # Simplify: Total users
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at.desc())
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    stats_list = []
    for row in rows:
        tenant, user_count = row
        stats_list.append(TenantStats(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status.value,
            created_at=tenant.created_at,
            restricted_modules=tenant.restricted_modules or [],
            total_users=user_count,
            logo_url=tenant.logo_url
        ))
        
    return stats_list

@router.put("/tenants/{tenant_id}", response_model=TenantStats)
@require_super_admin
async def update_tenant(
    tenant_id: str,
    data: SuperAdminTenantUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Update university details (name, status, restricted_modules, etc.).
    """
    tenant_query = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_query.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
        
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "domain" and not value:
            value = None
        setattr(tenant, field, value)
        
    # If suspending, we should maybe invalidate tokens (handled by middleware check)
    
    await db.commit()
    await db.refresh(tenant)
    
    # Get user count for response
    user_count = await db.scalar(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    
    # Return simple stats with user count
    return TenantStats(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        created_at=tenant.created_at,
        restricted_modules=tenant.restricted_modules or [],
        total_users=user_count or 0,
        logo_url=tenant.logo_url
    )


@router.delete("/tenants/{tenant_id}", status_code=204)
@require_super_admin
async def delete_tenant(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a university and all its data (cascade).
    This explicitly deletes all related records to ensure clean removal.
    """
    from sqlalchemy import delete
    from uuid import UUID
    
    try:
        uuid_id = UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")
    
    tenant = await db.get(Tenant, uuid_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
    
    # Explicit cascade delete (order matters - delete children first)
    # 1. Delete UserRoles for users in this tenant
    await db.execute(
        delete(UserRole).where(
            UserRole.user_id.in_(
                select(User.id).where(User.tenant_id == uuid_id)
            )
        )
    )
    
    # 2. Delete RolePermissions for roles in this tenant
    await db.execute(
        delete(RolePermission).where(
            RolePermission.role_id.in_(
                select(Role.id).where(Role.tenant_id == uuid_id)
            )
        )
    )
    
    # 3. Delete RefreshTokens for users in this tenant
    await db.execute(
        delete(RefreshToken).where(RefreshToken.tenant_id == uuid_id)
    )
    
    # 4. Delete Users
    await db.execute(delete(User).where(User.tenant_id == uuid_id))
    
    # 5. Delete Roles
    await db.execute(delete(Role).where(Role.tenant_id == uuid_id))
    
    # 6. Finally delete the Tenant
    await db.delete(tenant)
    await db.commit()
    
    return None

@router.get("/tenants/{tenant_id}/analytics", response_model=TenantAnalytics)
@require_super_admin
async def get_tenant_analytics(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed role distribution for a university.
    """
    # Count users by role name
    # Join User -> UserRole -> Role
    stmt = (
        select(Role.name, func.count(User.id))
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.tenant_id == tenant_id)
        .group_by(Role.name)
    )
    
    result = await db.execute(stmt)
    distribution = {row[0]: row[1] for row in result.all()}
    
    return TenantAnalytics(
        role_distribution=distribution,
        user_growth_monthly={"Jan": 10, "Feb": 20} # Placeholder for complex time-series
    )

@router.get("/stats", response_model=GlobalStats)
@require_super_admin
async def global_stats(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Platform-wide statistics.
    """
    # Total Tenants
    tenant_count = await db.scalar(select(func.count(Tenant.id)))
    
    # Active Tenants
    active_tenant_count = await db.scalar(
        select(func.count(Tenant.id))
        .where(Tenant.status == TenantStatus.ACTIVE)
    )
    
    # Total Users
    user_count = await db.scalar(select(func.count(User.id)))
    
    return GlobalStats(
        total_tenants=tenant_count or 0,
        active_tenants=active_tenant_count or 0,
        total_users_platform=user_count or 0,
        total_revenue_platform=0.0 # Calculate from Invoice/Payment table later
    )
