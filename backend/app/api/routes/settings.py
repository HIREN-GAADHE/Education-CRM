"""
Tenant Settings API Routes - CRUD operations for tenant settings
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
import shutil
import os
import uuid

from app.config.database import get_db
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission
from app.models.user import User
from app.models.settings import TenantSettings


router = APIRouter(prefix="/settings", tags=["Settings"])


# ============== Pydantic Schemas ==============

class AppearanceSettings(BaseModel):
    theme: Optional[str] = None
    primary_color: Optional[str] = None
    sidebar_collapsed: Optional[bool] = None
    language: Optional[str] = None
    timezone: Optional[str] = None


class SystemSettings(BaseModel):
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    academic_year: Optional[str] = None
    grading_system: Optional[str] = None


class NotificationSettings(BaseModel):
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    sms_alerts: Optional[bool] = None
    weekly_digest: Optional[bool] = None


class SecuritySettings(BaseModel):
    two_factor_enabled: Optional[bool] = None
    session_timeout_minutes: Optional[int] = None
    login_notifications: Optional[bool] = None
    api_access_enabled: Optional[bool] = None
    password_expiry_days: Optional[int] = None


class InstitutionSettings(BaseModel):
    institution_name: Optional[str] = None
    institution_logo_url: Optional[str] = None
    institution_address: Optional[str] = None
    institution_phone: Optional[str] = None
    institution_email: Optional[str] = None
    institution_website: Optional[str] = None


class SettingsUpdate(BaseModel):
    appearance: Optional[AppearanceSettings] = None
    system: Optional[SystemSettings] = None
    notifications: Optional[NotificationSettings] = None
    security: Optional[SecuritySettings] = None
    institution: Optional[InstitutionSettings] = None


class SettingsResponse(BaseModel):
    appearance: AppearanceSettings
    system: SystemSettings
    notifications: NotificationSettings
    security: SecuritySettings
    institution: InstitutionSettings

    class Config:
        from_attributes = True


# ============== Helper Functions ==============

from app.models.tenant import Tenant
from app.models.role import RoleLevel

# ============== Helper Functions ==============

async def get_or_create_settings(db: AsyncSession, tenant_id) -> TenantSettings:
    """Get existing settings or create default ones."""
    result = await db.execute(
        select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    
    if not settings:
        settings = TenantSettings(tenant_id=tenant_id)
        # Sync with tenant
        if tenant:
             settings.institution_name = tenant.name
             settings.institution_logo_url = tenant.logo_url
             settings.institution_email = tenant.email
             settings.institution_phone = tenant.phone
             if tenant.address_line1:
                 settings.institution_address = f"{tenant.address_line1}, {tenant.city or ''}, {tenant.country or ''}"
        
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    else:
        # Ensure we always serve the latest logo/name from Tenant if not overridden or if we treat Tenant as Truth
        # User requested: "i have changed the logo from super admin but it not showing me in unviersity login"
        # Super admin updates Tenant.logo_url. We should sync if they differ.
        if tenant:
            changed = False
            if tenant.logo_url and settings.institution_logo_url != tenant.logo_url:
                settings.institution_logo_url = tenant.logo_url
                changed = True
            if tenant.name and settings.institution_name != tenant.name:
                settings.institution_name = tenant.name
                changed = True
            
            if changed:
                await db.commit()
                await db.refresh(settings)
    
    return settings


def settings_to_response(settings: TenantSettings) -> SettingsResponse:
    """Convert model to response schema."""
    return SettingsResponse(
        appearance=AppearanceSettings(
            theme=settings.theme,
            primary_color=settings.primary_color,
            sidebar_collapsed=settings.sidebar_collapsed,
            language=settings.language,
            timezone=settings.timezone,
        ),
        system=SystemSettings(
            date_format=settings.date_format,
            time_format=settings.time_format,
            currency=settings.currency,
            currency_symbol=settings.currency_symbol,
            academic_year=settings.academic_year,
            grading_system=settings.grading_system,
        ),
        notifications=NotificationSettings(
            email_notifications=settings.email_notifications,
            push_notifications=settings.push_notifications,
            sms_alerts=settings.sms_alerts,
            weekly_digest=settings.weekly_digest,
        ),
        security=SecuritySettings(
            two_factor_enabled=settings.two_factor_enabled,
            session_timeout_minutes=settings.session_timeout_minutes,
            login_notifications=settings.login_notifications,
            api_access_enabled=settings.api_access_enabled,
            password_expiry_days=settings.password_expiry_days,
        ),
        institution=InstitutionSettings(
            institution_name=settings.institution_name,
            institution_logo_url=settings.institution_logo_url,
            institution_address=settings.institution_address,
            institution_phone=settings.institution_phone,
            institution_email=settings.institution_email,
            institution_website=settings.institution_website,
        ),
    )


# ============== API Endpoints ==============

@router.get("", response_model=SettingsResponse)
@require_permission("settings", "read")
async def get_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current tenant settings."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    return settings_to_response(settings)


@router.put("", response_model=SettingsResponse)
@require_permission("settings", "update")
async def update_settings(
    request: Request,
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update tenant settings."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    # Update appearance settings
    if data.appearance:
        if data.appearance.theme is not None:
            settings.theme = data.appearance.theme
        if data.appearance.primary_color is not None:
            settings.primary_color = data.appearance.primary_color
        if data.appearance.sidebar_collapsed is not None:
            settings.sidebar_collapsed = data.appearance.sidebar_collapsed
        if data.appearance.language is not None:
            settings.language = data.appearance.language
        if data.appearance.timezone is not None:
            settings.timezone = data.appearance.timezone
    
    # Update system settings
    if data.system:
        if data.system.date_format is not None:
            settings.date_format = data.system.date_format
        if data.system.time_format is not None:
            settings.time_format = data.system.time_format
        if data.system.currency is not None:
            settings.currency = data.system.currency
        if data.system.currency_symbol is not None:
            settings.currency_symbol = data.system.currency_symbol
        if data.system.academic_year is not None:
            settings.academic_year = data.system.academic_year
        if data.system.grading_system is not None:
            settings.grading_system = data.system.grading_system
    
    # Update notification settings
    if data.notifications:
        if data.notifications.email_notifications is not None:
            settings.email_notifications = data.notifications.email_notifications
        if data.notifications.push_notifications is not None:
            settings.push_notifications = data.notifications.push_notifications
        if data.notifications.sms_alerts is not None:
            settings.sms_alerts = data.notifications.sms_alerts
        if data.notifications.weekly_digest is not None:
            settings.weekly_digest = data.notifications.weekly_digest
    
    # Update security settings
    if data.security:
        if data.security.two_factor_enabled is not None:
            settings.two_factor_enabled = data.security.two_factor_enabled
        if data.security.session_timeout_minutes is not None:
            settings.session_timeout_minutes = data.security.session_timeout_minutes
        if data.security.login_notifications is not None:
            settings.login_notifications = data.security.login_notifications
        if data.security.api_access_enabled is not None:
            settings.api_access_enabled = data.security.api_access_enabled
        if data.security.password_expiry_days is not None:
            settings.password_expiry_days = data.security.password_expiry_days
    
    # Update institution settings
    if data.institution:
        tenant = await db.get(Tenant, current_user.tenant_id)

        if data.institution.institution_name is not None:
            settings.institution_name = data.institution.institution_name
            if tenant:
                tenant.name = data.institution.institution_name
                
        if data.institution.institution_logo_url is not None:
            settings.institution_logo_url = data.institution.institution_logo_url
            if tenant:
                tenant.logo_url = data.institution.institution_logo_url
                
        if data.institution.institution_address is not None:
            settings.institution_address = data.institution.institution_address
        if data.institution.institution_phone is not None:
            settings.institution_phone = data.institution.institution_phone
        if data.institution.institution_email is not None:
            settings.institution_email = data.institution.institution_email
        if data.institution.institution_website is not None:
            settings.institution_website = data.institution.institution_website
    
    await db.commit()
    await db.refresh(settings)
    
    return settings_to_response(settings)


@router.get("/appearance", response_model=AppearanceSettings)
@require_permission("settings", "read")
async def get_appearance_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get appearance settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    return AppearanceSettings(
        theme=settings.theme,
        primary_color=settings.primary_color,
        sidebar_collapsed=settings.sidebar_collapsed,
        language=settings.language,
        timezone=settings.timezone,
    )


@router.put("/appearance", response_model=AppearanceSettings)
@require_permission("settings", "update")
async def update_appearance_settings(
    request: Request,
    data: AppearanceSettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update appearance settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    if data.theme is not None:
        settings.theme = data.theme
    if data.primary_color is not None:
        settings.primary_color = data.primary_color
    if data.sidebar_collapsed is not None:
        settings.sidebar_collapsed = data.sidebar_collapsed
    if data.language is not None:
        settings.language = data.language
    if data.timezone is not None:
        settings.timezone = data.timezone
    
    await db.commit()
    await db.refresh(settings)
    
    return AppearanceSettings(
        theme=settings.theme,
        primary_color=settings.primary_color,
        sidebar_collapsed=settings.sidebar_collapsed,
        language=settings.language,
        timezone=settings.timezone,
    )


@router.get("/notifications", response_model=NotificationSettings)
@require_permission("settings", "read")
async def get_notification_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notification settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    return NotificationSettings(
        email_notifications=settings.email_notifications,
        push_notifications=settings.push_notifications,
        sms_alerts=settings.sms_alerts,
        weekly_digest=settings.weekly_digest,
    )


@router.put("/notifications", response_model=NotificationSettings)
@require_permission("settings", "update")
async def update_notification_settings(
    request: Request,
    data: NotificationSettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update notification settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    if data.email_notifications is not None:
        settings.email_notifications = data.email_notifications
    if data.push_notifications is not None:
        settings.push_notifications = data.push_notifications
    if data.sms_alerts is not None:
        settings.sms_alerts = data.sms_alerts
    if data.weekly_digest is not None:
        settings.weekly_digest = data.weekly_digest
    
    await db.commit()
    await db.refresh(settings)
    
    return NotificationSettings(
        email_notifications=settings.email_notifications,
        push_notifications=settings.push_notifications,
        sms_alerts=settings.sms_alerts,
        weekly_digest=settings.weekly_digest,
    )


@router.get("/security", response_model=SecuritySettings)
@require_permission("settings", "read")
async def get_security_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get security settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    return SecuritySettings(
        two_factor_enabled=settings.two_factor_enabled,
        session_timeout_minutes=settings.session_timeout_minutes,
        login_notifications=settings.login_notifications,
        api_access_enabled=settings.api_access_enabled,
        password_expiry_days=settings.password_expiry_days,
    )


@router.put("/security", response_model=SecuritySettings)
@require_permission("settings", "update")
async def update_security_settings(
    request: Request,
    data: SecuritySettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update security settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    if data.two_factor_enabled is not None:
        settings.two_factor_enabled = data.two_factor_enabled
    if data.session_timeout_minutes is not None:
        settings.session_timeout_minutes = data.session_timeout_minutes
    if data.login_notifications is not None:
        settings.login_notifications = data.login_notifications
    if data.api_access_enabled is not None:
        settings.api_access_enabled = data.api_access_enabled
    if data.password_expiry_days is not None:
        settings.password_expiry_days = data.password_expiry_days
    
    await db.commit()
    await db.refresh(settings)
    
    return SecuritySettings(
        two_factor_enabled=settings.two_factor_enabled,
        session_timeout_minutes=settings.session_timeout_minutes,
        login_notifications=settings.login_notifications,
        api_access_enabled=settings.api_access_enabled,
        password_expiry_days=settings.password_expiry_days,
    )


@router.get("/institution", response_model=InstitutionSettings)
@require_permission("settings", "read")
async def get_institution_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get institution settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    return InstitutionSettings(
        institution_name=settings.institution_name,
        institution_logo_url=settings.institution_logo_url,
        institution_address=settings.institution_address,
        institution_phone=settings.institution_phone,
        institution_email=settings.institution_email,
        institution_website=settings.institution_website,
    )


@router.post("/institution/logo", response_model=InstitutionSettings)
@require_permission("settings", "update")
async def upload_institution_logo(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload institution logo."""
    # Ensure only University Admin (or Super Admin) can upload logo
    # Role level 1 is University Admin
    # Use role_level from request state (populated from JWT) to avoid lazy loading issues
    role_level = getattr(request.state, "role_level", 99)
    
    if role_level > RoleLevel.UNIVERSITY_ADMIN.value:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only University Administrators can change the institution logo"
        )

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )
    
    # Create uploads directory if it doesn't exist
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    # Save file to DB
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read file: {str(e)}",
        )
        
    # Update settings
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    # Construct URL 
    logo_url = f"/api/v1/tenants/{current_user.tenant_id}/logo"
    settings.institution_logo_url = logo_url

    # Also sync to Tenant model (where binary is stored)
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant:
        tenant.logo_binary = content
        tenant.logo_content_type = file.content_type
        tenant.logo_url = logo_url
    
    await db.commit()
    await db.refresh(settings)
    
    return settings_to_response(settings).institution


@router.put("/institution", response_model=InstitutionSettings)
@require_permission("settings", "update")
async def update_institution_settings(
    request: Request,
    data: InstitutionSettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update institution settings only."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    tenant = await db.get(Tenant, current_user.tenant_id)
    
    if data.institution_name is not None:
        settings.institution_name = data.institution_name
        if tenant:
            tenant.name = data.institution_name

    if data.institution_logo_url is not None:
        settings.institution_logo_url = data.institution_logo_url
        if tenant:
            tenant.logo_url = data.institution_logo_url

    if data.institution_address is not None:
        settings.institution_address = data.institution_address
    if data.institution_phone is not None:
        settings.institution_phone = data.institution_phone
    if data.institution_email is not None:
        settings.institution_email = data.institution_email
    if data.institution_website is not None:
        settings.institution_website = data.institution_website
    
    await db.commit()
    await db.refresh(settings)
    
    return InstitutionSettings(
        institution_name=settings.institution_name,
        institution_logo_url=settings.institution_logo_url,
        institution_address=settings.institution_address,
        institution_phone=settings.institution_phone,
        institution_email=settings.institution_email,
        institution_website=settings.institution_website,
    )


@router.post("/reset", response_model=SettingsResponse)
@require_permission("settings", "update")
async def reset_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset all settings to default values."""
    settings = await get_or_create_settings(db, current_user.tenant_id)
    
    # Reset appearance
    settings.theme = "light"
    settings.primary_color = "#667eea"
    settings.sidebar_collapsed = False
    settings.language = "en"
    settings.timezone = "Asia/Kolkata"
    
    # Reset system
    settings.date_format = "DD/MM/YYYY"
    settings.time_format = "12h"
    settings.currency = "INR"
    settings.currency_symbol = "₹"
    settings.academic_year = None
    settings.grading_system = "percentage"
    
    # Reset notifications
    settings.email_notifications = True
    settings.push_notifications = True
    settings.sms_alerts = False
    settings.weekly_digest = True
    
    # Reset security
    settings.two_factor_enabled = False
    settings.session_timeout_minutes = 30
    settings.login_notifications = True
    settings.api_access_enabled = False
    settings.password_expiry_days = 90
    
    # Reset institution (keep values as they are important)
    # Don't reset institution info - just security/appearance/system
    
    await db.commit()
    await db.refresh(settings)
    
    return settings_to_response(settings)

