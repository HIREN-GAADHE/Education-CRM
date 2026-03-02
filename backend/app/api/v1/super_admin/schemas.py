from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID

from app.models.tenant import TenantStatus


class SuperAdminTenantCreate(BaseModel):
    """Schema for creating a new university/tenant."""
    name: str = Field(..., description="Name of the university")
    slug: str = Field(..., description="Unique URL slug")
    domain: Optional[str] = Field(None, description="Custom domain (e.g. university.com)")
    email: EmailStr = Field(..., description="Contact email for the institution")
    
    # initial admin user
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8)
    admin_first_name: str
    admin_last_name: str
    
    # optional details
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "India"
    
    # subscription
    plan_id: Optional[UUID] = None
    features: List[str] = []


class SuperAdminTenantUpdate(BaseModel):
    """Schema for updating tenant details."""
    name: Optional[str] = None
    status: Optional[TenantStatus] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    is_active: Optional[bool] = None
    restricted_modules: Optional[List[str]] = None


class TenantAdminAction(BaseModel):
    """Schema for creating or resetting university admin."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str
    action: str = Field("create", description="'create' or 'reset-password'")


class TenantStats(BaseModel):
    """Statistics for a single tenant."""
    id: UUID
    name: str
    slug: str
    status: str
    created_at: datetime
    logo_url: Optional[str] = None
    restricted_modules: List[str] = []
    total_users: int = 0
    total_staff: int = 0
    total_students: int = 0


class TenantDetail(TenantStats):
    """Detailed information for a single tenant."""
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    plan_id: Optional[UUID] = None
    features: List[str] = []
    active_users: int = 0
    total_revenue: float = 0.0
    storage_used_gb: float = 0.0


class TenantAnalytics(BaseModel):
    """Detailed analytics for a tenant."""
    role_distribution: Dict[str, int] = {}
    user_growth_monthly: Dict[str, int] = {}
    recent_activity: List[Dict[str, Any]] = []


class GlobalStats(BaseModel):
    """Platform-wide statistics."""
    total_tenants: int
    active_tenants: int
    total_users_platform: int
    total_students_platform: int = 0
    total_staff_platform: int = 0
    total_revenue_platform: float
    system_health: str = "Healthy"


class TenantUserItem(BaseModel):
    """Single user in a tenant for cross-tenant user listing."""
    id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: str = "active"
    role_name: Optional[str] = None
    role_level: Optional[int] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class AuditLogEntry(BaseModel):
    """Single audit log entry."""
    id: str
    timestamp: datetime
    level: str = "INFO"
    action: str
    user_email: str
    tenant_name: Optional[str] = None
    details: str = ""
    ip_address: Optional[str] = None


class PlatformSettings(BaseModel):
    """Platform-wide settings that the super admin can configure."""
    platform_name: str = "EduSphere ERP"
    support_email: str = "support@eduerp.com"
    maintenance_mode: bool = False
    allow_new_registrations: bool = True
    default_plan: str = "free"
    max_students_per_tenant: int = 5000
    max_staff_per_tenant: int = 500
