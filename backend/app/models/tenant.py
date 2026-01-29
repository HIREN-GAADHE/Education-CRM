from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import BaseModel, TimestampMixin


class TenantStatus(str, enum.Enum):
    """Tenant status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    EXPIRED = "expired"


class Tenant(BaseModel, TimestampMixin):
    """
    Tenant model representing an institution/university.
    This is the root of multi-tenancy hierarchy.
    """
    __tablename__ = "tenants"
    
    # Basic Information
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    domain = Column(String(255), nullable=True, unique=True)
    
    # Organization Details
    legal_name = Column(String(255), nullable=True)
    registration_number = Column(String(100), nullable=True)
    tax_id = Column(String(50), nullable=True)
    
    # Contact Information
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), default="India")
    postal_code = Column(String(20), nullable=True)
    
    # Branding
    logo_url = Column(String(500), nullable=True)
    favicon_url = Column(String(500), nullable=True)
    logo_binary = Column(LargeBinary, nullable=True)  # Store logo as BLOB
    logo_content_type = Column(String(50), nullable=True) # e.g. image/png
    primary_color = Column(String(7), default="#1976d2")  # Hex color
    secondary_color = Column(String(7), default="#dc004e")
    
    # Status
    status = Column(
        SQLEnum(TenantStatus),
        default=TenantStatus.TRIAL,
        nullable=False,
        index=True
    )
    
    # Subscription
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
    subscription_starts_at = Column(DateTime, nullable=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    
    # Configuration
    settings = Column(JSONB, default={})
    features = Column(ARRAY(String), default=[])
    restricted_modules = Column(ARRAY(String), default=[])
    timezone = Column(String(50), default="Asia/Kolkata")
    locale = Column(String(10), default="en-IN")
    currency = Column(String(3), default="INR")
    
    # Limits
    max_users = Column(Integer, default=100)
    max_students = Column(Integer, default=1000)
    storage_limit_gb = Column(Integer, default=10)
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    users = relationship("User", back_populates="tenant", lazy="dynamic")
    modules = relationship("TenantModule", back_populates="tenant", lazy="dynamic")
    roles = relationship("Role", back_populates="tenant", lazy="dynamic")
    
    def __repr__(self):
        return f"<Tenant {self.slug}>"
    
    @property
    def is_active(self) -> bool:
        """Check if tenant is active and subscription is valid."""
        if self.status != TenantStatus.ACTIVE:
            return False
        if self.subscription_expires_at and self.subscription_expires_at < datetime.utcnow():
            return False
        return True


class SubscriptionPlan(BaseModel, TimestampMixin):
    """
    Subscription plan model for tenant billing.
    """
    __tablename__ = "subscription_plans"
    
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Pricing
    price_monthly = Column(Integer, default=0)  # In smallest currency unit (paise)
    price_yearly = Column(Integer, default=0)
    currency = Column(String(3), default="INR")
    
    # Limits
    max_users = Column(Integer, default=100)
    max_students = Column(Integer, default=1000)
    max_branches = Column(Integer, default=1)
    storage_limit_gb = Column(Integer, default=10)
    
    # Features
    features = Column(ARRAY(String), default=[])
    modules = Column(ARRAY(String), default=[])
    
    # Status
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=True)
    
    # Relationships
    tenants = relationship("Tenant", backref="plan", lazy="dynamic")
    
    def __repr__(self):
        return f"<SubscriptionPlan {self.code}>"
