from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import TenantBaseModel, AuditableModel


class UserStatus(str, enum.Enum):
    """User status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"  # Email not verified
    LOCKED = "locked"    # Too many failed attempts


class Gender(str, enum.Enum):
    """Gender enumeration."""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class User(TenantBaseModel):
    """
    User model representing all users in the system.
    Users belong to a tenant and can have multiple roles.
    """
    __tablename__ = "users"
    
    # Authentication
    email = Column(String(255), nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Null for SSO users
    phone = Column(String(20), nullable=True, index=True)
    username = Column(String(100), nullable=True, index=True)
    
    # Profile
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    display_name = Column(String(200), nullable=True)
    
    # Personal Information
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(SQLEnum(Gender), nullable=True)
    
    # Avatar
    avatar_url = Column(String(500), nullable=True)
    
    # Status
    status = Column(
        SQLEnum(UserStatus),
        default=UserStatus.PENDING,
        nullable=False,
        index=True
    )
    
    # Verification
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime, nullable=True)
    phone_verified = Column(Boolean, default=False)
    phone_verified_at = Column(DateTime, nullable=True)
    
    # Security
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    must_change_password = Column(Boolean, default=False)
    
    # Two-Factor Authentication
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)
    two_factor_recovery_codes = Column(ARRAY(String), nullable=True)
    
    # Preferences
    preferences = Column(JSONB, default={})
    notification_settings = Column(JSONB, default={
        "email": True,
        "sms": True,
        "push": True,
        "in_app": True
    })
    timezone = Column(String(50), nullable=True)
    locale = Column(String(10), default="en")
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    roles = relationship(
        "UserRole",
        back_populates="user",
        lazy="select",  # Changed from "dynamic" to fix eager loading
        primaryjoin="User.id == foreign(UserRole.user_id)"
    )
    refresh_tokens = relationship("RefreshToken", back_populates="user", lazy="select")
    
    # Unique constraint for email per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='uq_user_tenant_email'),
        UniqueConstraint('tenant_id', 'username', name='uq_user_tenant_username'),
    )
    
    def __repr__(self):
        return f"<User {self.email}>"
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        if self.last_name:
            parts.append(self.last_name)
        return " ".join(parts)
    
    @property
    def is_active(self) -> bool:
        """Check if user is active."""
        return self.status == UserStatus.ACTIVE
    
    @property
    def is_locked(self) -> bool:
        """Check if user is locked."""
        if self.status == UserStatus.LOCKED:
            return True
        if self.locked_until and self.locked_until > datetime.utcnow():
            return True
        return False


class RefreshToken(TenantBaseModel):
    """
    Refresh token model for JWT token management.
    """
    __tablename__ = "refresh_tokens"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    
    # Device info
    device_name = Column(String(255), nullable=True)
    device_type = Column(String(50), nullable=True)  # mobile, desktop, tablet
    browser = Column(String(100), nullable=True)
    os = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Validity
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    
    def __repr__(self):
        return f"<RefreshToken {self.id}>"
    
    @property
    def is_valid(self) -> bool:
        """Check if refresh token is still valid."""
        if self.revoked_at:
            return False
        if self.expires_at < datetime.utcnow():
            return False
        return True
