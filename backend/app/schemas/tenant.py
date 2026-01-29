from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

from app.models.tenant import TenantStatus


class TenantBase(BaseModel):
    """Base tenant schema with common fields."""
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r'^[a-z0-9-]+$')
    email: str
    phone: Optional[str] = None
    website: Optional[str] = None


class TenantCreate(TenantBase):
    """Schema for creating a new tenant."""
    domain: Optional[str] = Field(None, min_length=3, max_length=255, pattern=r'^[a-z0-9.-]+\.[a-z]{2,}$')
    legal_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    postal_code: Optional[str] = None
    
    # Admin user for the tenant
    admin_email: str
    admin_password: str = Field(..., min_length=8)
    admin_first_name: str
    admin_last_name: Optional[str] = None


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    legal_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    timezone: Optional[str] = None
    locale: Optional[str] = None


class TenantResponse(BaseModel):
    """Tenant response schema."""
    id: UUID
    name: str
    slug: str
    domain: Optional[str] = None
    email: str
    phone: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str
    secondary_color: str
    status: TenantStatus
    timezone: str
    locale: str
    currency: str
    max_users: int
    max_students: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    """Paginated tenant list response."""
    items: List[TenantResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TenantSettingsUpdate(BaseModel):
    """Schema for updating tenant settings."""
    settings: dict


class TenantBrandingUpdate(BaseModel):
    """Schema for updating tenant branding."""
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    secondary_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')


class SlugCheckRequest(BaseModel):
    """Schema for checking slug availability."""
    slug: str = Field(..., min_length=2, max_length=100, pattern=r'^[a-z0-9-]+$')


class SlugCheckResponse(BaseModel):
    """Response for slug availability check."""
    slug: str
    available: bool


class PublicTenantInfo(BaseModel):
    """Public tenant information for branding."""
    name: str
    slug: str
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
