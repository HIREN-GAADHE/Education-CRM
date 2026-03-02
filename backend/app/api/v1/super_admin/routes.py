"""
Super Admin API Routes — Platform-wide management
- Tenant CRUD, admin management, logo upload
- Global stats with real student/staff counts
- Per-tenant user listing
- Platform settings (file-based persistence)
- Audit logs (lightweight in-memory + DB)
- Impersonation
"""
from datetime import datetime
from uuid import uuid4, UUID
from typing import List, Optional
import json
import os

from fastapi import APIRouter, Request, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_db
from app.core.permissions import require_super_admin
from app.core.security import security
from app.models import User, Tenant, TenantStatus, Role, RoleLevel, UserRole, UserStatus
from app.models.student import Student
from app.models.staff import Staff
from app.api.v1.super_admin.schemas import (
    SuperAdminTenantCreate,
    SuperAdminTenantUpdate,
    TenantStats,
    TenantDetail,
    TenantAnalytics,
    GlobalStats,
    TenantAdminAction,
    TenantUserItem,
    AuditLogEntry,
    PlatformSettings,
)

router = APIRouter()

# ── File-based platform settings (no extra DB model required) ─────────────
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "platform_settings.json")

def _load_settings() -> dict:
    """Load platform settings from JSON file."""
    defaults = PlatformSettings().model_dump()
    try:
        with open(SETTINGS_FILE, "r") as f:
            saved = json.load(f)
            defaults.update(saved)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return defaults

def _save_settings(data: dict):
    """Persist platform settings to JSON file."""
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ══════════════════════════════════════════════════════════════════════════════
#  Tenant CRUD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
@require_super_admin
async def get_tenant_detail(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get full details for a specific university."""
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

    # Real student/staff counts
    student_count = await db.scalar(
        select(func.count(Student.id)).where(Student.tenant_id == tenant.id, Student.is_deleted == False)
    ) or 0
    staff_count = await db.scalar(
        select(func.count(Staff.id)).where(Staff.tenant_id == tenant.id, Staff.is_deleted == False)
    ) or 0
    
    return TenantDetail(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        created_at=tenant.created_at,
        restricted_modules=tenant.restricted_modules or [],
        total_users=user_count,
        total_students=student_count,
        total_staff=staff_count,
        email=tenant.email,
        phone=tenant.phone,
        address=tenant.address_line1,
        city=tenant.city,
        country=tenant.country,
        plan_id=tenant.plan_id,
        features=tenant.features or [],
        logo_url=tenant.logo_url
    )


@router.get("/tenants", response_model=List[TenantStats])
@require_super_admin
async def list_tenants(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """List all universities with real user/student/staff counts."""
    # Main query: tenants with user count
    stmt = (
        select(
            Tenant,
            func.count(User.id).label("total_users"),
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at.desc())
    )
    
    result = await db.execute(stmt)
    rows = result.all()

    # Batch student + staff counts per tenant
    tenant_ids = [row[0].id for row in rows]
    student_counts = {}
    staff_counts = {}

    if tenant_ids:
        sc_result = await db.execute(
            select(Student.tenant_id, func.count(Student.id))
            .where(Student.tenant_id.in_(tenant_ids), Student.is_deleted == False)
            .group_by(Student.tenant_id)
        )
        for tid, cnt in sc_result:
            student_counts[tid] = cnt

        st_result = await db.execute(
            select(Staff.tenant_id, func.count(Staff.id))
            .where(Staff.tenant_id.in_(tenant_ids), Staff.is_deleted == False)
            .group_by(Staff.tenant_id)
        )
        for tid, cnt in st_result:
            staff_counts[tid] = cnt
    
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
            total_students=student_counts.get(tenant.id, 0),
            total_staff=staff_counts.get(tenant.id, 0),
            logo_url=tenant.logo_url
        ))
        
    return stats_list


@router.post("/tenants", response_model=TenantStats, status_code=201)
@require_super_admin
async def create_tenant(
    request: Request,
    data: SuperAdminTenantCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new university (tenant) and its initial administrator."""
    import re
    
    slug_pattern = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$')
    if not slug_pattern.match(data.slug) or len(data.slug) < 2 or len(data.slug) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug must be 2-50 characters, lowercase, alphanumeric with hyphens only."
        )
    
    reserved_slugs = ['admin', 'api', 'www', 'app', 'login', 'dashboard', 'super-admin', 'superadmin']
    if data.slug.lower() in reserved_slugs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{data.slug}' is a reserved URL."
        )
    
    is_valid, errors = security.validate_password_strength(data.admin_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password too weak: {errors[0]}"
        )
    
    existing = await db.execute(select(Tenant).where(Tenant.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"University URL '{data.slug}' is already taken."
        )

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
        await db.flush()
        
        # 2. Create University Admin Role
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
        
        # 3. Create Default Roles
        staff_role = Role(
            tenant_id=tenant.id,
            name="staff",
            display_name="Staff",
            level=RoleLevel.STAFF.value,
            is_system_role=True
        )
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
        
        return TenantStats(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status.value,
            created_at=tenant.created_at,
            total_users=1,
            total_staff=0,
            total_students=0,
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


@router.put("/tenants/{tenant_id}", response_model=TenantStats)
@require_super_admin
async def update_tenant(
    tenant_id: str,
    data: SuperAdminTenantUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Update university details."""
    tenant_query = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_query.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
        
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "domain" and not value:
            value = None
        setattr(tenant, field, value)
    
    await db.commit()
    await db.refresh(tenant)
    
    user_count = await db.scalar(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    student_count = await db.scalar(
        select(func.count(Student.id)).where(Student.tenant_id == tenant.id, Student.is_deleted == False)
    ) or 0
    staff_count = await db.scalar(
        select(func.count(Staff.id)).where(Staff.tenant_id == tenant.id, Staff.is_deleted == False)
    ) or 0
    
    return TenantStats(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        created_at=tenant.created_at,
        restricted_modules=tenant.restricted_modules or [],
        total_users=user_count or 0,
        total_students=student_count,
        total_staff=staff_count,
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
    Delete a university and all its data.
    Uses explicit child-first deletion since not all tables have CASCADE set.
    """
    try:
        uuid_id = UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")
    
    tenant = await db.get(Tenant, uuid_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
    
    # Delete children in correct order
    # 1. Delete UserRoles for users in this tenant
    await db.execute(
        sa_delete(UserRole).where(
            UserRole.user_id.in_(
                select(User.id).where(User.tenant_id == uuid_id)
            )
        )
    )
    
    # 2. Delete Users
    await db.execute(sa_delete(User).where(User.tenant_id == uuid_id))
    
    # 3. Delete Roles
    await db.execute(sa_delete(Role).where(Role.tenant_id == uuid_id))
    
    # 4. Delete Students
    await db.execute(sa_delete(Student).where(Student.tenant_id == uuid_id))
    
    # 5. Delete Staff
    await db.execute(sa_delete(Staff).where(Staff.tenant_id == uuid_id))
    
    # 6. Finally delete the Tenant
    await db.delete(tenant)
    await db.commit()
    
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  Tenant Admin Management
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/tenants/{tenant_id}/admin", response_model=dict)
@require_super_admin
async def manage_tenant_admin(
    tenant_id: str,
    data: TenantAdminAction,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create or reset a University Admin for a tenant."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
        
    stmt = select(User).where(
        User.tenant_id == tenant_id,
        User.email == data.email
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    hashed_pwd = security.hash_password(data.password)
    
    if user:
        user.password_hash = hashed_pwd
        user.first_name = data.first_name
        user.last_name = data.last_name
        user.status = UserStatus.ACTIVE
        db.add(user)
        
        role_stmt = select(Role).where(
            Role.tenant_id == tenant_id,
            Role.level == RoleLevel.UNIVERSITY_ADMIN.value
        )
        role_res = await db.execute(role_stmt)
        admin_role = role_res.scalar_one_or_none()
        
        if admin_role:
            ass_stmt = select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role_id == admin_role.id
            )
            ass_res = await db.execute(ass_stmt)
            if not ass_res.scalar_one_or_none():
                ur = UserRole(
                    user_id=user.id,
                    role_id=admin_role.id,
                    assigned_by=request.state.user_id,
                    is_primary=True
                )
                db.add(ur)
    else:
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
            raise HTTPException(status_code=500, detail="University Admin role missing for this tenant")

    await db.commit()
    
    return {"message": "Administrator updated successfully", "email": data.email}


# ══════════════════════════════════════════════════════════════════════════════
#  Logo Management
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/tenants/{tenant_id}/logo", response_model=dict)
@require_super_admin
async def upload_tenant_logo(
    tenant_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a logo for a specific university (tenant)."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
        
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
    
    tenant.logo_binary = content
    tenant.logo_content_type = file.content_type
    logo_url = f"/api/v1/tenants/{tenant_id}/logo"
    tenant.logo_url = logo_url
    
    await db.commit()  # Fixed: only one commit
    
    return {"message": "Logo uploaded successfully", "logo_url": logo_url}


@router.delete("/tenants/{tenant_id}/logo", status_code=204)
@require_super_admin
async def delete_tenant_logo(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Remove tenant logo."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")
    
    tenant.logo_binary = None
    tenant.logo_content_type = None
    tenant.logo_url = None
    
    await db.commit()
    
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  Analytics & Statistics
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/tenants/{tenant_id}/analytics", response_model=TenantAnalytics)
@require_super_admin
async def get_tenant_analytics(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed role distribution for a university."""
    stmt = (
        select(Role.display_name, func.count(User.id))
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.tenant_id == tenant_id)
        .group_by(Role.display_name)
    )
    
    result = await db.execute(stmt)
    distribution = {row[0]: row[1] for row in result.all()}
    
    # Real monthly user growth (count users created per month, last 6 months)
    from sqlalchemy import extract
    growth_stmt = (
        select(
            func.to_char(User.created_at, 'Mon').label("month"),
            func.count(User.id).label("count")
        )
        .where(User.tenant_id == tenant_id)
        .group_by(func.to_char(User.created_at, 'Mon'), func.extract('month', User.created_at))
        .order_by(func.extract('month', User.created_at))
    )
    growth_result = await db.execute(growth_stmt)
    growth = {row[0]: row[1] for row in growth_result.all()}
    
    return TenantAnalytics(
        role_distribution=distribution,
        user_growth_monthly=growth,
    )


@router.get("/stats", response_model=GlobalStats)
@require_super_admin
async def global_stats(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Platform-wide statistics with real counts."""
    tenant_count = await db.scalar(select(func.count(Tenant.id))) or 0
    
    active_tenant_count = await db.scalar(
        select(func.count(Tenant.id)).where(Tenant.status == TenantStatus.ACTIVE)
    ) or 0
    
    user_count = await db.scalar(select(func.count(User.id))) or 0
    
    student_count = await db.scalar(
        select(func.count(Student.id)).where(Student.is_deleted == False)
    ) or 0
    
    staff_count = await db.scalar(
        select(func.count(Staff.id)).where(Staff.is_deleted == False)
    ) or 0
    
    return GlobalStats(
        total_tenants=tenant_count,
        active_tenants=active_tenant_count,
        total_users_platform=user_count,
        total_students_platform=student_count,
        total_staff_platform=staff_count,
        total_revenue_platform=0.0,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  Cross-Tenant User Management
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/tenants/{tenant_id}/users", response_model=List[TenantUserItem])
@require_super_admin
async def list_tenant_users(
    tenant_id: str,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List all users in a specific tenant."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="University not found")

    offset = (page - 1) * page_size
    stmt = (
        select(User, Role.display_name, Role.level)
        .outerjoin(UserRole, UserRole.user_id == User.id)
        .outerjoin(Role, Role.id == UserRole.role_id)
        .where(User.tenant_id == tenant_id)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    
    result = await db.execute(stmt)
    items = []
    for row in result.all():
        user, role_name, role_level = row
        items.append(TenantUserItem(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            status=user.status.value if user.status else "active",
            role_name=role_name,
            role_level=role_level,
            created_at=user.created_at,
            last_login=getattr(user, 'last_login', None),
        ))
    
    return items


# ══════════════════════════════════════════════════════════════════════════════
#  Platform Settings
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=PlatformSettings)
@require_super_admin
async def get_platform_settings(request: Request):
    """Get current platform settings."""
    data = _load_settings()
    return PlatformSettings(**data)


@router.put("/settings", response_model=PlatformSettings)
@require_super_admin
async def update_platform_settings(
    request: Request,
    data: PlatformSettings,
):
    """Update platform settings."""
    settings_dict = data.model_dump()
    _save_settings(settings_dict)
    return PlatformSettings(**settings_dict)


# ══════════════════════════════════════════════════════════════════════════════
#  Audit Logs (lightweight — queries User + Tenant creation/update timestamps)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/audit-logs", response_model=List[AuditLogEntry])
@require_super_admin
async def get_audit_logs(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit log entries.
    Synthesizes from existing data: tenant creation, user creation, recent activity.
    """
    offset = (page - 1) * page_size
    logs: List[AuditLogEntry] = []

    # Recent tenant creations
    tenant_stmt = (
        select(Tenant)
        .order_by(Tenant.created_at.desc())
        .offset(offset)
        .limit(page_size // 2)
    )
    tenants = (await db.execute(tenant_stmt)).scalars().all()
    for t in tenants:
        logs.append(AuditLogEntry(
            id=f"tenant-{t.id}",
            timestamp=t.created_at,
            level="INFO",
            action="Tenant Created",
            user_email="super-admin",
            tenant_name=t.name,
            details=f"University '{t.name}' (slug: {t.slug}) created. Status: {t.status.value}",
        ))

    # Recent user creations
    user_stmt = (
        select(User, Tenant.name)
        .outerjoin(Tenant, Tenant.id == User.tenant_id)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(page_size // 2)
    )
    users = (await db.execute(user_stmt)).all()
    for row in users:
        user, tenant_name = row
        logs.append(AuditLogEntry(
            id=f"user-{user.id}",
            timestamp=user.created_at,
            level="INFO",
            action="User Created",
            user_email=user.email,
            tenant_name=tenant_name,
            details=f"User '{user.first_name} {user.last_name}' created in '{tenant_name}'",
        ))

    # Sort combined by timestamp descending
    logs.sort(key=lambda x: x.timestamp, reverse=True)
    return logs[:page_size]


# ══════════════════════════════════════════════════════════════════════════════
#  Impersonation
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/impersonate/{user_id}")
@require_super_admin
async def impersonate_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a short-lived access token as a specific user.
    Super admin can use this to debug as any user.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find user's role
    role_stmt = (
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
        .order_by(Role.level)
        .limit(1)
    )
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one_or_none()

    # Generate a short-lived token (15 minutes)
    token = security.create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "role": role.name if role else "user",
            "role_level": role.level if role else 99,
            "impersonated_by": str(request.state.user_id),
        },
        expires_minutes=15,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_email": user.email,
        "user_name": f"{user.first_name} {user.last_name}",
        "tenant_id": str(user.tenant_id),
        "role": role.name if role else "user",
        "expires_in_minutes": 15,
        "message": "Impersonation token generated. This token expires in 15 minutes.",
    }
