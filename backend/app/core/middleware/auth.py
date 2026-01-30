from typing import Optional
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

    PUBLIC_PATHS = [
        r"^/$",
        r"^/health/?$",
        r"^/favicon\.ico$",

        r"^/api/v1/auth/login/?$",
        r"^/api/v1/auth/register/?$",
        r"^/api/v1/auth/forgot-password/?$",
        r"^/api/v1/auth/reset-password/?$",
        r"^/api/v1/auth/verify-email/?$",
        r"^/api/v1/auth/refresh/?$",

        r"^/api/v1/tenants/check-slug/?$",
        r"^/api/v1/tenants/public-info/?$",
        r"^/api/v1/tenants/.*/logo/?$",

        r"^/api/v1/health.*",

        r"^/docs.*",
        r"^/redoc.*",
        r"^/openapi.json$",
        r"^/static/.*",
    ]

    def __init__(self, app):
        super().__init__(app)
        self._public_patterns = [re.compile(p) for p in self.PUBLIC_PATHS]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Allow public routes
        if self._is_public_route(path):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header.replace("Bearer ", "")

        payload = security.verify_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
            )

        user = await self._get_user(payload.get("sub"))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not active",
            )

        if user.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is locked",
            )

        # Attach user context
        request.state.user = user
        request.state.user_id = user.id
        request.state.roles = payload.get("roles", [])
        request.state.permissions = payload.get("permissions", [])
        request.state.role_level = payload.get("role_level", 99)

        return await call_next(request)

    def _is_public_route(self, path: str) -> bool:
        for pattern in self._public_patterns:
            if pattern.match(path):
                return True
        return False

    async def _get_user(self, user_id: str) -> Optional[User]:
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
            except Exception:
                return None


class JWTBearer(HTTPBearer):
    """
    FastAPI dependency for JWT authentication.
    """

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[dict]:
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)

        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization code",
            )

        if credentials.scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme",
            )

        payload = security.verify_access_token(credentials.credentials)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        return payload


def get_auth_middleware():
    return AuthMiddleware


async def get_current_user(request: Request) -> User:
    if not hasattr(request.state, "user") or request.state.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return request.state.user


async def get_current_active_user(request: Request) -> User:
    user = await get_current_user(request)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )
    return user
