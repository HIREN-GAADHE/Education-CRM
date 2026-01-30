from typing import Optional, List
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import re

from app.config.database import AsyncSessionLocal
from app.core.security import security
from app.models.user import User


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware that validates JWT tokens and loads user context.
    """
    
    # Routes that don't require authentication
    PUBLIC_PATHS = [
        r"^/health$",  # Root level health check
        r"^/favicon\.ico$",
        r"^/api/v1/auth/login$",
        r"^/api/v1/auth/register$",
        r"^/api/v1/auth/forgot-password$",
        r"^/api/v1/auth/reset-password$",
        r"^/api/v1/auth/verify-email$",
        r"^/api/v1/auth/refresh$",
        r"^/api/v1/health$",
        r"^/api/v1/health/.*$",
        r"^/docs$",
        r"^/redoc$",
        r"^/openapi.json$",
        r"^/api/v1/tenants/check-slug$",
        r"^/api/v1/tenants/public-info$",
        r"^/api/v1/tenants/.*/logo$",
        r"^/static/.*$",
    ]
    
    def __init__(self, app):
        super().__init__(app)
        self._public_patterns = [re.compile(p) for p in self.PUBLIC_PATHS]
    
    async def dispatch(self, request: Request, call_next):
        # Check if route is public
        if self._is_public_route(request.url.path):
            return await call_next(request)
        
        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Verify token
        payload = security.verify_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Load user from database
        user = await self._get_user(payload.get("sub"))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not active"
            )
        
        # Check if user is locked
        if user.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is locked"
            )
        
        # Verify tenant match
        if hasattr(request.state, 'tenant_id'):
            if str(user.tenant_id) != str(request.state.tenant_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User does not belong to this tenant"
                )
        
        # Get role_level from JWT payload (avoids lazy loading issues)
        # role_level: 0=Super Admin, 1=University Admin, 2=Admin, 3=Staff, 4=User
        role_level = payload.get("role_level", 99)  # Default to lowest privilege
        
        # Attach user context to request
        request.state.user = user
        request.state.user_id = user.id
        request.state.roles = payload.get("roles", [])
        request.state.permissions = payload.get("permissions", [])
        request.state.role_level = role_level
        request.state.tenant_modules = []  # Will be populated if needed
        
        response = await call_next(request)
        return response
    
    def _is_public_route(self, path: str) -> bool:
        """Check if the path is a public route."""
        return any(pattern.match(path) for pattern in self._public_patterns)
    
    async def _get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID with roles loaded."""
        async with AsyncSessionLocal() as db:
            try:
                from uuid import UUID
                uuid_obj = UUID(user_id)
                result = await db.execute(
                    select(User)
                    .where(User.id == uuid_obj)
                    .options(selectinload(User.roles))
                )
                return result.scalar_one_or_none()
            except ValueError:
                return None


class JWTBearer(HTTPBearer):
    """
    FastAPI dependency for JWT authentication.
    Use this for route-level authentication.
    """
    
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
    
    async def __call__(self, request: Request) -> Optional[dict]:
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)
        
        if not credentials:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authorization code",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            return None
        
        if credentials.scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        payload = security.verify_access_token(credentials.credentials)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return payload


def get_auth_middleware():
    """Factory function to create auth middleware."""
    return AuthMiddleware


async def get_current_user(request: Request) -> User:
    """
    Dependency to get the current authenticated user.
    Use this in route dependencies to require authentication.
    
    Usage:
        @router.get("/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            ...
    """
    if not hasattr(request.state, 'user') or request.state.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return request.state.user


async def get_current_active_user(request: Request) -> User:
    """
    Dependency to get the current active authenticated user.
    """
    user = await get_current_user(request)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    return user

