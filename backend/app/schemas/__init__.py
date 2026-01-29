from .auth import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    VerifyEmailRequest,
    UserBasic,
)
from .user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    UserResponse,
    UserListResponse,
    RoleBasic,
    AssignRoleRequest,
)
from .tenant import (
    TenantBase,
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantListResponse,
    TenantSettingsUpdate,
    TenantBrandingUpdate,
    SlugCheckRequest,
    SlugCheckResponse,
    PublicTenantInfo,
)
from .role import (
    RoleBase,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
    PermissionBase,
    PermissionResponse,
    PermissionListResponse,
    RolePermissionUpdate,
)
from .module import (
    ModuleBase,
    ModuleResponse,
    ModuleListResponse,
    TenantModuleResponse,
    TenantModulesResponse,
    ModuleToggleRequest,
    ModuleSettingsUpdate,
    RoleModuleAccessRequest,
    RoleModuleAccessResponse,
)
from .common import (
    HealthResponse,
    SuccessResponse,
    ErrorResponse,
    PaginatedResponse,
    PaginationParams,
    SearchParams,
    BulkOperationRequest,
    BulkOperationRequest,
    BulkOperationResponse,
)
from .academic import (
    SchoolClassCreate,
    SchoolClassUpdate,
    SchoolClassResponse,
)

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "RefreshTokenRequest",
    "RefreshTokenResponse",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "ChangePasswordRequest",
    "VerifyEmailRequest",
    "UserBasic",
    
    # User
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    "UserResponse",
    "UserListResponse",
    "RoleBasic",
    "AssignRoleRequest",
    
    # Tenant
    "TenantBase",
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantListResponse",
    "TenantSettingsUpdate",
    "TenantBrandingUpdate",
    "SlugCheckRequest",
    "SlugCheckResponse",
    "PublicTenantInfo",
    
    # Role
    "RoleBase",
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "RoleListResponse",
    "PermissionBase",
    "PermissionResponse",
    "PermissionListResponse",
    "RolePermissionUpdate",
    
    # Module
    "ModuleBase",
    "ModuleResponse",
    "ModuleListResponse",
    "TenantModuleResponse",
    "TenantModulesResponse",
    "ModuleToggleRequest",
    "ModuleSettingsUpdate",
    "RoleModuleAccessRequest",
    "RoleModuleAccessResponse",
    
    # Common
    "HealthResponse",
    "SuccessResponse",
    "ErrorResponse",
    "PaginatedResponse",
    "PaginationParams",
    "SearchParams",
    "BulkOperationRequest",
    "BulkOperationRequest",
    "BulkOperationResponse",

    # Academic
    "SchoolClassCreate",
    "SchoolClassUpdate",
    "SchoolClassResponse",
]
