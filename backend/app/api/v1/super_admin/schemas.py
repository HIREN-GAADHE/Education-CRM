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
    address: Optional[str] = None # Renamed from address_line1 to match SuperAdminTenantCreate
    city: Optional[str] = None
    country: Optional[str] = None
    plan_id: Optional[UUID] = None # Changed to UUID to match SuperAdminTenantCreate
    features: List[str] = []
    
    # Additional fields from original TenantStats that are not in the new TenantStats
    active_users: int = 0
    total_revenue: float = 0.0
    storage_used_gb: float = 0.0

class TenantAnalytics(BaseModel):
    """Detailed analytics for a tenant."""
    role_distribution: Dict[str, int] = {}  # "Teacher": 20, "Student": 500
    user_growth_monthly: Dict[str, int] = {}
    recent_activity: List[Dict[str, Any]] = []

class GlobalStats(BaseModel):
    """Platform-wide statistics."""
    total_tenants: int
    active_tenants: int
    total_users_platform: int
    total_revenue_platform: float
    system_health: str = "Healthy"
