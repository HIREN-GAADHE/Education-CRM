from fastapi import APIRouter, Request, Depends, HTTPException, status, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Tuple, List
from uuid import UUID

from app.config import get_db, settings
from app.core.security import security
from app.core.exceptions import InvalidCredentialsException, AccountLockedException
from app.models import User, UserStatus, RefreshToken, Role, UserRole, RolePermission, Permission
from app.schemas import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    ForgotPasswordRequest,
    ChangePasswordRequest,
    SuccessResponse,
    UserBasic,
)

router = APIRouter()


async def get_user_roles_and_permissions(
    db: AsyncSession, 
    user_id: UUID
) -> Tuple[List[str], List[str], int]:
    """
    Load user roles and permissions from the database.
    
    Returns:
        Tuple of (role_names, permission_codes, min_role_level)
    """
    # Step 1: Get user's roles
    role_stmt = (
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    
    role_result = await db.execute(role_stmt)
    user_roles = role_result.scalars().all()
    
    if not user_roles:
        # No roles assigned - return minimal defaults
        return ["User"], ["profile:read"], 4
    
    role_names = []
    permission_codes = set()
    min_level = 99  # Track highest privilege (lowest number)
    role_ids = []
    
    for role in user_roles:
        role_names.append(role.display_name or role.name)
        role_ids.append(role.id)
        
        # Track minimum level (highest privilege)
        if role.level < min_level:
            min_level = role.level
        
        # Check for tenant admin (full tenant access)
        if role.is_tenant_admin:
            permission_codes.add("admin:*")
        
        # Check for super admin level
        if role.level == 0:
            permission_codes.add("*:*")  # Super admin gets all permissions
    
    # Step 2: Get permissions for these roles (separate query)
    if role_ids:
        perm_stmt = (
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id.in_(role_ids))
            .where(RolePermission.granted == True)
        )
        perm_result = await db.execute(perm_stmt)
        for row in perm_result:
            permission_codes.add(row[0])
    
    return role_names, list(permission_codes), min_level

@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,  # Inject Response object
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and return access token. Refresh token is set in HttpOnly cookie.
    """
    # ... (auth logic same until token creation) ...
    # Get tenant from request state (set by middleware)
    tenant_id = getattr(request.state, 'tenant_id', None)
    
    # Find user by email
    query = select(User).where(User.email == data.email)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        raise InvalidCredentialsException()
    
    # Check if user is locked
    if user.is_locked:
        raise AccountLockedException()
    
    # Verify password
    if not security.verify_password(data.password, user.password_hash):
        # Increment failed attempts
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.status = UserStatus.LOCKED
            user.locked_until = datetime.utcnow()
        await db.commit()
        raise InvalidCredentialsException()
    
    # Check if user is active
    if user.status != UserStatus.ACTIVE:
        if user.status == UserStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email first"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
    
    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.last_login_at = datetime.utcnow()
    
    # Load roles and permissions from database
    roles, permissions, role_level = await get_user_roles_and_permissions(db, user.id)
    
    # Get tenant's restricted_modules
    from app.models import Tenant
    tenant = await db.get(Tenant, user.tenant_id)
    restricted_modules = tenant.restricted_modules if tenant and tenant.restricted_modules else []
    
    # Get user's allowed modules from their role's module access
    from app.models.module import RoleModuleAccess, Module, AccessLevel
    from app.models import UserRole
    
    allowed_modules = []

    # --- Check if user has tenant-admin or super-admin privileges ---------------
    # Load user roles to detect admin flags
    user_roles_result = await db.execute(
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
    )
    user_all_roles = user_roles_result.scalars().all()
    is_tenant_or_super_admin = (
        role_level <= 2
        or any(getattr(r, 'is_tenant_admin', False) for r in user_all_roles)
    )

    if is_tenant_or_super_admin:
        # Admins always get access to ALL modules — ignore per-role restrictions
        all_modules_result = await db.execute(select(Module.code))
        allowed_modules = [m.lower() for m in all_modules_result.scalars().all()]
    else:
        # Get user's primary role module assignments for non-admin users
        user_role_result = await db.execute(
            select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.is_primary == True
            )
        )
        user_role = user_role_result.scalar_one_or_none()

        if user_role:
            module_access_result = await db.execute(
                select(RoleModuleAccess, Module.code)
                .join(Module, Module.id == RoleModuleAccess.module_id)
                .where(RoleModuleAccess.role_id == user_role.role_id)
                .where(RoleModuleAccess.access_level != AccessLevel.NONE)
            )
            for row in module_access_result.all():
                rma, module_code = row
                allowed_modules.append(module_code.lower())
        # If still empty for non-admin: empty list = sidebar shows all (backwards compat)

    # Get tenant settings for session timeout
    from app.api.routes.settings import get_or_create_settings
    tenant_settings = await get_or_create_settings(db, user.tenant_id)
    session_minutes = tenant_settings.session_timeout_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES

    # Create tokens
    access_token = security.create_access_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id),
        roles=roles,
        permissions=permissions,
        role_level=role_level,
        expires_minutes=session_minutes
    )
    
    refresh_token, token_hash, expires_at = security.create_refresh_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id)
    )
    
    # Store refresh token
    db_refresh_token = RefreshToken(
        tenant_id=user.tenant_id,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        device_name="Web Browser",
        ip_address=request.client.host if request.client else None
    )
    db.add(db_refresh_token)
    await db.commit()
    
    # Set Refresh Token Cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # From settings
    )
    
    return LoginResponse(
        access_token=access_token,
        # refresh_token=refresh_token, # Removed from body
        token_type="bearer",
        expires_in=session_minutes * 60,
        user=UserBasic(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            avatar_url=user.avatar_url,
            roles=roles,
            role_level=role_level,
            restricted_modules=restricted_modules,
            allowed_modules=allowed_modules
        )
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a new access token using a refresh token from cookie.
    """
    # Try to get token from cookie first, then body
    refresh_token = request.cookies.get("refresh_token") or data.refresh_token
    
    if not refresh_token:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )
        
    # Verify refresh token JWT signature and type
    payload = security.verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    
    # Verify token exists in DB and is not revoked
    import hashlib
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    token_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow()
        )
    )
    db_token = token_result.scalar_one_or_none()
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked or expired"
        )
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Load roles and permissions from database
    roles, permissions, role_level = await get_user_roles_and_permissions(db, user.id)
    
    # Get tenant settings for session timeout
    from app.api.routes.settings import get_or_create_settings
    tenant_settings = await get_or_create_settings(db, user.tenant_id)
    session_minutes = tenant_settings.session_timeout_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES

    access_token = security.create_access_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id),
        roles=roles,
        permissions=permissions,
        role_level=role_level,
        expires_minutes=session_minutes
    )
    
    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=session_minutes * 60
    )


@router.post("/logout", response_model=SuccessResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Logout user and invalidate refresh token.
    """
    # Clear cookie
    response.delete_cookie(key="refresh_token")
    
    # Get user from request state
    user = getattr(request.state, 'user', None)
    if not user:
        return SuccessResponse(success=True, message="Logged out")
    
    # Revoke all refresh tokens for this user
    from sqlalchemy import update
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    await db.commit()
    
    return SuccessResponse(success=True, message="Logged out successfully")


@router.post("/forgot-password", response_model=SuccessResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request password reset email.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == data.email)
    )
    user = result.scalar_one_or_none()
    
    # Always return success to prevent email enumeration
    if user:
        # TODO: Generate reset token and send email
        pass
    
    return SuccessResponse(
        success=True,
        message="If an account exists with this email, a password reset link will be sent."
    )


@router.post("/change-password", response_model=SuccessResponse)
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Change user password.
    """
    user = request.state.user
    
    # Verify current password
    if not security.verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    is_valid, errors = security.validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0]
        )
    
    # Update password
    user.password_hash = security.hash_password(data.new_password)
    user.password_changed_at = datetime.utcnow()
    user.must_change_password = False
    await db.commit()
    
    return SuccessResponse(success=True, message="Password changed successfully")
