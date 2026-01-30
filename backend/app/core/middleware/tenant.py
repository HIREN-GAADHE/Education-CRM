from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import re
import os

from app.config.database import AsyncSessionLocal
from app.models.tenant import Tenant, TenantStatus


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to resolve and validate tenant from request.

    Tenant can be determined by:
    1. X-Tenant-ID header (UUID)
    2. X-Tenant-Slug header (slug)
    3. JWT token (tenant_id claim)
    4. Subdomain (tenant.app.com)
    5. Custom domain mapping
    """

    # Routes that don't require tenant resolution
    PUBLIC_PATHS = [
        r"^/$",
        r"^/health/?$",
        r"^/favicon\.ico$",

        r"^/docs/?$",
        r"^/redoc/?$",
        r"^/openapi.json$",

        r"^/api/v1/auth/.*$",
        r"^/api/v1/health.*$",
        r"^/api/v1/tenants/check-slug.*$",
        r"^/api/v1/tenants/public-info.*$",
        r"^/api/v1/tenants/.*/logo.*$",

        r"^/static/.*$",
        r"^/api/v1/super-admin/.*$",
    ]

    def __init__(self, app):
        super().__init__(app)
        self._public_patterns = [re.compile(p) for p in self.PUBLIC_PATHS]

    async def dispatch(self, request: Request, call_next):

        path = request.url.path

        # ✅ Skip tenant resolution for public routes
        if self._is_public_route(path):
            return await call_next(request)

        tenant = await self._resolve_tenant(request)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant could not be determined. Please provide X-Tenant-ID or X-Tenant-Slug header."
            )

        # Validate tenant status
        if tenant.status == TenantStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This institution account has been suspended."
            )

        if tenant.status == TenantStatus.INACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This institution account is inactive."
            )

        if tenant.status == TenantStatus.EXPIRED:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Subscription has expired."
            )

        # Attach tenant to request
        request.state.tenant = tenant
        request.state.tenant_id = tenant.id
        request.state.tenant_modules = tenant.features or []

        return await call_next(request)

    def _is_public_route(self, path: str) -> bool:
        return any(pattern.match(path) for pattern in self._public_patterns)

    async def _resolve_tenant(self, request: Request) -> Optional[Tenant]:
        async with AsyncSessionLocal() as db:

            # Strategy 1: X-Tenant-ID header
            tenant_id = request.headers.get("X-Tenant-ID")
            if tenant_id:
                tenant = await self._get_tenant_by_id(db, tenant_id)
                if tenant:
                    return tenant

            # Strategy 2: X-Tenant-Slug header
            tenant_slug = request.headers.get("X-Tenant-Slug")
            if tenant_slug:
                tenant = await self._get_tenant_by_slug(db, tenant_slug)
                if tenant:
                    return tenant

            # Strategy 3: JWT token
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                try:
                    from jose import jwt
                    token = auth_header.split(" ")[1]
                    claims = jwt.get_unverified_claims(token)
                    tenant_id = claims.get("tenant_id")
                    if tenant_id:
                        tenant = await self._get_tenant_by_id(db, tenant_id)
                        if tenant:
                            return tenant
                except Exception:
                    pass

            # Strategy 4: Domain / subdomain
            host = request.headers.get("host", "")
            if host:
                tenant = await self._get_tenant_from_host(db, host)
                if tenant:
                    return tenant

            # Strategy 5: Default tenant (local/dev only)
            if os.getenv("ALLOW_DEFAULT_TENANT", "false").lower() == "true":
                default_slug = os.getenv("DEFAULT_TENANT_SLUG")
                if default_slug:
                    return await self._get_tenant_by_slug(db, default_slug)

                result = await db.execute(select(Tenant).limit(1))
                return result.scalar_one_or_none()

            return None

    async def _get_tenant_by_id(self, db: AsyncSession, tenant_id: str) -> Optional[Tenant]:
        try:
            from uuid import UUID
            uuid_obj = UUID(tenant_id)
            result = await db.execute(select(Tenant).where(Tenant.id == uuid_obj))
            return result.scalar_one_or_none()
        except ValueError:
            return None

    async def _get_tenant_by_slug(self, db: AsyncSession, slug: str) -> Optional[Tenant]:
        result = await db.execute(
            select(Tenant).where(Tenant.slug == slug.lower())
        )
        return result.scalar_one_or_none()

    async def _get_tenant_from_host(self, db: AsyncSession, host: str) -> Optional[Tenant]:
        if not host:
            return None

        host = host.split(":")[0]

        # Custom domain
        result = await db.execute(
            select(Tenant).where(Tenant.domain == host)
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant

        # Subdomain
        parts = host.split(".")
        if len(parts) >= 3:
            subdomain = parts[0]
            if subdomain not in ["www", "api", "admin", "app"]:
                return await self._get_tenant_by_slug(db, subdomain)

        return None


def get_tenant_middleware():
    return TenantMiddleware
