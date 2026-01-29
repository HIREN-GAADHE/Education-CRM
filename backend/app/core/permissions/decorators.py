from functools import wraps
from typing import List, Optional, Union, Callable, Any
from fastapi import HTTPException, status, Request


def require_permission(
    resource: str,
    action: str,
    module: Optional[str] = None
) -> Callable:
    """
    Decorator to check if user has required permission.
    
    Usage:
        @require_permission("students", "create", module="STUDENT_MGMT")
        async def create_student(request: Request, ...):
            ...
    
    Args:
        resource: Resource name (e.g., "students", "courses")
        action: Action name (e.g., "create", "read", "update", "delete")
        module: Optional module code that must be enabled for tenant
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get request from args or kwargs
            request = kwargs.get('request')
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found in handler"
                )
            
            # Check if user is authenticated
            if not hasattr(request.state, 'user') or not request.state.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            permissions = getattr(request.state, 'permissions', [])
            
            # Check module access first if specified
            if module:
                # 1. Check Blocked/Restricted Modules (Read-Only Mode)
                restricted_modules = []
                if hasattr(request.state, 'tenant') and request.state.tenant:
                    # Handle both dictionary and object access
                    tenant_obj = request.state.tenant
                    if isinstance(tenant_obj, dict):
                         restricted_modules = tenant_obj.get('restricted_modules', []) or []
                    else:
                         restricted_modules = getattr(tenant_obj, 'restricted_modules', []) or []
                
                # Canonicalize action for check
                safe_actions = ['read', 'list', 'get', 'view', 'fetch', 'retrieve']
                if module in restricted_modules and action.lower() not in safe_actions:
                     raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Module '{module}' is in read-only mode for your institution."
                    )

                # 2. Check Enabled Features
                # Module access should be checked via middleware or service
                # For now, we assume it's available in request state
                tenant_modules = getattr(request.state, 'tenant_modules', [])
                if module not in tenant_modules:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Module '{module}' is not available for your institution"
                    )
            
            # Build required permission string
            required_permission = f"{resource}:{action}"
            
            # Check for permission match
            has_permission = (
                required_permission in permissions or
                f"{resource}:*" in permissions or  # Wildcard action
                "*:*" in permissions or             # Super admin
                "admin:*" in permissions            # Admin wildcard
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {required_permission}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_permissions(
    permissions: List[str],
    require_all: bool = True
) -> Callable:
    """
    Decorator to check for multiple permissions.
    
    Usage:
        @require_permissions(["students:read", "courses:read"], require_all=True)
        async def get_student_courses(request: Request, ...):
            ...
    
    Args:
        permissions: List of permission strings
        require_all: If True, all permissions required. If False, any one is sufficient.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found in handler"
                )
            
            user_permissions = getattr(request.state, 'permissions', [])
            
            # Super admin bypass
            if "*:*" in user_permissions or "admin:*" in user_permissions:
                return await func(*args, **kwargs)
            
            # Check permissions
            if require_all:
                # All permissions required
                missing = [p for p in permissions if not _has_permission(p, user_permissions)]
                if missing:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Missing permissions: {', '.join(missing)}"
                    )
            else:
                # At least one permission required
                has_any = any(_has_permission(p, user_permissions) for p in permissions)
                if not has_any:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"At least one of these permissions required: {', '.join(permissions)}"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_role(
    min_level: int = None,
    roles: List[str] = None
) -> Callable:
    """
    Decorator to check user role level or specific roles.
    
    Usage:
        @require_role(min_level=2)  # Admin or higher
        async def admin_action(request: Request, ...):
            ...
        
        @require_role(roles=["UNIVERSITY_ADMIN", "ADMIN"])
        async def specific_role_action(request: Request, ...):
            ...
    
    Args:
        min_level: Minimum role level required (0=Super Admin, 1=Univ Admin, etc.)
        roles: List of specific role names allowed
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found in handler"
                )
            
            user_roles = getattr(request.state, 'roles', [])
            user_role_level = getattr(request.state, 'role_level', 99)
            
            # Check minimum level
            if min_level is not None:
                if user_role_level > min_level:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Insufficient role level"
                    )
            
            # Check specific roles
            if roles is not None:
                if not any(role in user_roles for role in roles):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Required role: {', '.join(roles)}"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_super_admin(func: Callable) -> Callable:
    """
    Decorator that requires Super Admin role (level 0).
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request')
        if not request:
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
        
        if not request:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Request object not found in handler"
            )
        
        user_role_level = getattr(request.state, 'role_level', 99)
        
        if user_role_level != 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action requires Super Admin privileges"
            )
        
        return await func(*args, **kwargs)
    return wrapper


def require_tenant_admin(func: Callable) -> Callable:
    """
    Decorator that requires Tenant Admin role (level 1 or lower).
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request')
        if not request:
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
        
        if not request:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Request object not found in handler"
            )
        
        user_role_level = getattr(request.state, 'role_level', 99)
        
        if user_role_level > 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action requires Institution Admin privileges"
            )
        
        return await func(*args, **kwargs)
    return wrapper


def _has_permission(required: str, user_permissions: List[str]) -> bool:
    """
    Check if user has a specific permission.
    Supports wildcard matching.
    """
    if required in user_permissions:
        return True
    
    # Check wildcards
    resource = required.split(":")[0] if ":" in required else required
    
    if f"{resource}:*" in user_permissions:
        return True
    
    if "*:*" in user_permissions:
        return True
    
    return False
