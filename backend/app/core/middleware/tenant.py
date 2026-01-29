from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.config.database import AsyncSessionLocal
from app.models.tenant import Tenant, TenantStatus


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to resolve and validate tenant from request.
    
    Tenant can be determined by:
    1. X-Tenant-ID header (UUID)
    2. X-Tenant-Slug header (slug)
    3. Subdomain (tenant.app.com)
    4. Custom domain mapping
    
    Public routes bypass tenant validation.
    """
    
    # Routes that don't require tenant resolution
    PUBLIC_PATHS = [
        r"^/api/v1/auth/.*$",  # All auth routes
        r"^/api/v1/health$",
        r"^/api/v1/health/.*$",
        r"^/docs$",
        r"^/redoc$",
        r"^/openapi.json$",
        r"^/health$",
        r"^/api/v1/tenants/check-slug$",
        r"^/api/v1/tenants/public-info$",
        r"^/api/v1/tenants/.*/logo$",
        r"^/api/v1/super-admin/.*$",  # Super admin routes handle tenant differently
    ]
    
    def __init__(self, app):
        super().__init__(app)
        self._public_patterns = [re.compile(p) for p in self.PUBLIC_PATHS]
    
    async def dispatch(self, request: Request, call_next):
        # Check if route is public
        if self._is_public_route(request.url.path):
            return await call_next(request)
        
        # Try to resolve tenant
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
                detail="This institution account has been suspended. Please contact support."
            )
        
        if tenant.status == TenantStatus.INACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This institution account is inactive."
            )
        
        if tenant.status == TenantStatus.EXPIRED:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Subscription has expired. Please renew to continue."
            )
        
        # Attach tenant to request state
        request.state.tenant = tenant
        request.state.tenant_id = tenant.id
        request.state.tenant_modules = tenant.features or []  # Populate module access
        
        response = await call_next(request)
        return response
    
    def _is_public_route(self, path: str) -> bool:
        """Check if the path is a public route."""
        return any(pattern.match(path) for pattern in self._public_patterns)
    
    async def _resolve_tenant(self, request: Request) -> Optional[Tenant]:
        """
        Resolve tenant from request using multiple strategies.
        """
        async with AsyncSessionLocal() as db:
            # Strategy 1: X-Tenant-ID header
            tenant_id = request.headers.get("X-Tenant-ID")
            if tenant_id:
                return await self._get_tenant_by_id(db, tenant_id)
            
            # Strategy 2: X-Tenant-Slug header
            tenant_slug = request.headers.get("X-Tenant-Slug")
            if tenant_slug:
                return await self._get_tenant_by_slug(db, tenant_slug)
            
            # Strategy 3: Authorization Header (JWT)
            # This allows authenticated requests to work without explicit tenant headers
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                try:
                    from jose import jwt
                    token = auth_header.split(" ")[1]
                    # Decode without verification here - AuthMiddleware validates signature
                    claims = jwt.get_unverified_claims(token)
                    tenant_id = claims.get("tenant_id")
                    if tenant_id:
                        tenant = await self._get_tenant_by_id(db, tenant_id)
                        if tenant:
                            return tenant
                except Exception:
                    pass
            
            # Strategy 4: Subdomain
            host = request.headers.get("host", "")
            tenant = await self._get_tenant_from_host(db, host)
            if tenant:
                return tenant
                
            # Strategy 5: Default Tenant for Local Development
            # Only fallback to default tenant if explicitly enabled via config
            # This prevents accidental data leaks between tenants
            import os
            if os.getenv("ALLOW_DEFAULT_TENANT", "false").lower() == "true":
                if "localhost" in host or "127.0.0.1" in host:
                    default_slug = os.getenv("DEFAULT_TENANT_SLUG")
                    if default_slug:
                        return await self._get_tenant_by_slug(db, default_slug)
                    # Fallback to first tenant only if slug not specified
                    result = await db.execute(select(Tenant).limit(1))
                    return result.scalar_one_or_none()
            
            return None
    
    async def _get_tenant_by_id(self, db: AsyncSession, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by UUID."""
        try:
            from uuid import UUID
            uuid_obj = UUID(tenant_id)
            result = await db.execute(
                select(Tenant).where(Tenant.id == uuid_obj)
            )
            return result.scalar_one_or_none()
        except ValueError:
            return None
    
    async def _get_tenant_by_slug(self, db: AsyncSession, slug: str) -> Optional[Tenant]:
        """Get tenant by slug."""
        result = await db.execute(
            select(Tenant).where(Tenant.slug == slug.lower())
        )
        return result.scalar_one_or_none()
    
    async def _get_tenant_from_host(self, db: AsyncSession, host: str) -> Optional[Tenant]:
        """
        Extract tenant from host header.
        Supports both subdomain and custom domain.
        """
        if not host:
            return None
        
        # Remove port if present
        host = host.split(":")[0]
        
        # Check for custom domain first
        result = await db.execute(
            select(Tenant).where(Tenant.domain == host)
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant
        
        # Check for subdomain (format: tenant.app.com)
        parts = host.split(".")
        if len(parts) >= 3:
            subdomain = parts[0]
            # Skip common subdomains
            if subdomain not in ["www", "api", "admin", "app"]:
                return await self._get_tenant_by_slug(db, subdomain)
        
        return None


def get_tenant_middleware():
    """Factory function to create tenant middleware."""
    return TenantMiddleware
