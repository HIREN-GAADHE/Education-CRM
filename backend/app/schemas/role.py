from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum


class AccessLevelEnum(str, Enum):
    """Access level for role-module access."""
    NONE = "none"
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    FULL = "full"


class ModuleAccessItem(BaseModel):
    """Module access configuration for a role."""
    module_key: str  # e.g., "students", "fees", "attendance"
    access_level: AccessLevelEnum = AccessLevelEnum.FULL


class RoleBase(BaseModel):
    """Base role schema."""
    name: str = Field(..., min_length=2, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    level: int = Field(3, ge=1, le=4)  # Default to staff level, exclude super admin level 0


class RoleCreate(RoleBase):
    """Schema for creating a role."""
    parent_role_id: Optional[UUID] = None
    permission_ids: List[UUID] = []
    module_access: List[ModuleAccessItem] = []  # Module access list
    icon: str = "person"
    color: str = "#666666"


class RoleUpdate(BaseModel):
    """Schema for updating a role."""
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    module_access: Optional[List[ModuleAccessItem]] = None  # Module access list


class ModuleAccessResponse(BaseModel):
    """Module access in role response."""
    module_key: str
    access_level: str
    
    class Config:
        from_attributes = True


class ModuleInfo(BaseModel):
    """Module metadata info."""
    key: str
    name: str
    icon: str
    category: str


class RoleResponse(BaseModel):
    """Role response schema."""
    id: UUID
    name: str
    display_name: str
    description: Optional[str] = None
    level: int
    is_system_role: bool
    is_tenant_admin: bool
    is_default: bool = False
    is_active: bool
    icon: str
    color: str
    parent_role_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    permissions: List["PermissionResponse"] = []
    module_access: List[ModuleAccessResponse] = []  # Module access list
    user_count: int = 0
    
    class Config:
        from_attributes = True



class RoleListResponse(BaseModel):
    """Paginated role list response."""
    items: List[RoleResponse]
    total: int


class PermissionBase(BaseModel):
    """Base permission schema."""
    code: str
    resource: str
    action: str
    display_name: str
    description: Optional[str] = None
    category: Optional[str] = None


class PermissionResponse(BaseModel):
    """Permission response schema."""
    id: UUID
    code: str
    resource: str
    action: str
    display_name: str
    description: Optional[str] = None
    category: Optional[str] = None
    module_id: Optional[UUID] = None
    is_system: bool
    
    class Config:
        from_attributes = True


class PermissionListResponse(BaseModel):
    """Permissions grouped by category."""
    categories: dict  # {category: [PermissionResponse]}


class RolePermissionUpdate(BaseModel):
    """Schema for updating role permissions."""
    permission_ids: List[UUID]


# Rebuild model to resolve forward references
RoleResponse.model_rebuild()


