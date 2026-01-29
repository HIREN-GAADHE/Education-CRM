from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from app.models.user import User
from app.models.tenant import Tenant

async def get_current_user(request: Request) -> User:
    """
    Dependency to get the current authenticated user from request state.
    The user is populated by the AuthMiddleware.
    """
    if not hasattr(request.state, 'user') or request.state.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return request.state.user

async def get_current_tenant(request: Request) -> Tenant:
    """
    Dependency to get the current resolved tenant from request state.
    The tenant is populated by the TenantMiddleware.
    """
    if not hasattr(request.state, 'tenant') or request.state.tenant is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context missing"
        )
    return request.state.tenant
