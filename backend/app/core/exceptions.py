from typing import Any, Optional, Dict
from fastapi import HTTPException, status


class BaseAppException(HTTPException):
    """Base exception for application errors."""
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code or f"ERR_{status_code}"


class NotFoundException(BaseAppException):
    """Raised when a requested resource is not found."""
    
    def __init__(self, resource: str, identifier: Any = None):
        detail = f"{resource} not found"
        if identifier:
            detail = f"{resource} with id '{identifier}' not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND"
        )


class UnauthorizedException(BaseAppException):
    """Raised when authentication fails."""
    
    def __init__(self, detail: str = "Authentication required"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"}
        )


class ForbiddenException(BaseAppException):
    """Raised when user lacks permission."""
    
    def __init__(self, detail: str = "Access denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="FORBIDDEN"
        )


class BadRequestException(BaseAppException):
    """Raised for invalid request data."""
    
    def __init__(self, detail: str = "Invalid request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="BAD_REQUEST"
        )


class ConflictException(BaseAppException):
    """Raised when resource already exists or conflict occurs."""
    
    def __init__(self, detail: str = "Resource conflict"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="CONFLICT"
        )


class ValidationException(BaseAppException):
    """Raised for validation errors."""
    
    def __init__(self, detail: str = "Validation error", errors: Optional[list] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            error_code="VALIDATION_ERROR"
        )
        self.errors = errors or []


class TenantNotFoundException(NotFoundException):
    """Raised when tenant is not found."""
    
    def __init__(self, identifier: Any = None):
        super().__init__("Tenant", identifier)
        self.error_code = "TENANT_NOT_FOUND"


class UserNotFoundException(NotFoundException):
    """Raised when user is not found."""
    
    def __init__(self, identifier: Any = None):
        super().__init__("User", identifier)
        self.error_code = "USER_NOT_FOUND"


class InvalidCredentialsException(UnauthorizedException):
    """Raised for invalid login credentials."""
    
    def __init__(self):
        super().__init__(detail="Invalid email or password")
        self.error_code = "INVALID_CREDENTIALS"


class AccountLockedException(ForbiddenException):
    """Raised when account is locked."""
    
    def __init__(self, detail: str = "Account is locked. Please try again later."):
        super().__init__(detail=detail)
        self.error_code = "ACCOUNT_LOCKED"


class TokenExpiredException(UnauthorizedException):
    """Raised when token has expired."""
    
    def __init__(self):
        super().__init__(detail="Token has expired")
        self.error_code = "TOKEN_EXPIRED"


class ModuleNotEnabledException(ForbiddenException):
    """Raised when module is not enabled for tenant."""
    
    def __init__(self, module: str):
        super().__init__(detail=f"Module '{module}' is not enabled for your institution")
        self.error_code = "MODULE_NOT_ENABLED"


class PermissionDeniedException(ForbiddenException):
    """Raised when user lacks specific permission."""
    
    def __init__(self, permission: str):
        super().__init__(detail=f"Permission denied: {permission}")
        self.error_code = "PERMISSION_DENIED"


class RateLimitExceededException(BaseAppException):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
            error_code="RATE_LIMIT_EXCEEDED",
            headers={"Retry-After": str(retry_after)}
        )


class EmailAlreadyExistsException(ConflictException):
    """Raised when email is already registered."""
    
    def __init__(self):
        super().__init__(detail="Email address is already registered")
        self.error_code = "EMAIL_EXISTS"
