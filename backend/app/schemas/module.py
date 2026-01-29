from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

from app.models.module import ModuleCategory, AccessLevel


class ModuleBase(BaseModel):
    """Base module schema."""
    code: str
    name: str
    description: Optional[str] = None
    category: ModuleCategory


class ModuleResponse(BaseModel):
    """Module response schema."""
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    category: ModuleCategory
    is_core: bool
    is_premium: bool
    is_beta: bool
    is_active: bool
    icon: str
    color: str
    menu_order: int
    version: str
    depends_on: List[str] = []
    
    class Config:
        from_attributes = True


class ModuleListResponse(BaseModel):
    """Module list response grouped by category."""
    modules: List[ModuleResponse]
    by_category: dict  # {category: [ModuleResponse]}


class TenantModuleResponse(BaseModel):
    """Tenant module status response."""
    module_id: UUID
    module_code: str
    module_name: str
    is_enabled: bool
    enabled_at: Optional[datetime] = None
    usage_limit: Optional[int] = None
    current_usage: int = 0
    settings: dict = {}
    
    class Config:
        from_attributes = True


class TenantModulesResponse(BaseModel):
    """All tenant modules response."""
    enabled: List[TenantModuleResponse]
    available: List[ModuleResponse]


class ModuleToggleRequest(BaseModel):
    """Request to enable/disable a module."""
    module_id: UUID
    enabled: bool


class ModuleSettingsUpdate(BaseModel):
    """Request to update module settings."""
    module_id: UUID
    settings: dict


class RoleModuleAccessRequest(BaseModel):
    """Request to set role's module access."""
    role_id: UUID
    module_id: UUID
    access_level: AccessLevel
    allowed_actions: List[str] = []
    denied_actions: List[str] = []


class RoleModuleAccessResponse(BaseModel):
    """Role module access response."""
    role_id: UUID
    module_id: UUID
    module_code: str
    module_name: str
    access_level: AccessLevel
    allowed_actions: List[str] = []
    denied_actions: List[str] = []
    
    class Config:
        from_attributes = True
