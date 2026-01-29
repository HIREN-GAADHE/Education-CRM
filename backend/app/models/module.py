from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import BaseModel, TenantBaseModel, TimestampMixin


class ModuleCategory(str, enum.Enum):
    """Module category enumeration."""
    CORE = "core"
    ACADEMIC = "academic"
    ADMINISTRATIVE = "administrative"
    FINANCE = "finance"
    COMMUNICATION = "communication"
    HR = "hr"
    ANALYTICS = "analytics"
    INTEGRATION = "integration"


class AccessLevel(str, enum.Enum):
    """Access level for role-module access."""
    NONE = "none"
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    FULL = "full"


class Module(BaseModel, TimestampMixin):
    """
    Module model representing feature modules in the system.
    Modules can be enabled/disabled per tenant.
    """
    __tablename__ = "modules"
    
    # Identification
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Categorization
    category = Column(SQLEnum(ModuleCategory), default=ModuleCategory.CORE)
    
    # Dependencies
    depends_on = Column(ARRAY(String), default=[])  # Module codes this module depends on
    
    # Feature Flags
    is_core = Column(Boolean, default=False)        # Core modules cannot be disabled
    is_premium = Column(Boolean, default=False)     # Requires paid plan
    is_beta = Column(Boolean, default=False)        # Beta feature
    is_active = Column(Boolean, default=True)       # Globally active
    
    # Versioning
    version = Column(String(20), default="1.0.0")
    min_plan_level = Column(Integer, default=0)     # Minimum subscription plan level
    
    # UI Configuration
    icon = Column(String(50), default="extension")
    color = Column(String(7), default="#1976d2")
    menu_order = Column(Integer, default=100)
    routes = Column(JSONB, default=[])              # Frontend route definitions
    
    # Settings schema
    settings_schema = Column(JSONB, default={})     # JSON schema for module settings
    default_settings = Column(JSONB, default={})
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    permissions = relationship("Permission", back_populates="module", lazy="dynamic")
    tenant_modules = relationship("TenantModule", back_populates="module", lazy="dynamic")
    role_access = relationship("RoleModuleAccess", back_populates="module", lazy="dynamic")
    
    def __repr__(self):
        return f"<Module {self.code}>"


class TenantModule(BaseModel, TimestampMixin):
    """
    Many-to-many relationship between tenants and modules.
    Tracks which modules are enabled for each tenant.
    """
    __tablename__ = "tenant_modules"
    
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    module_id = Column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Status
    is_enabled = Column(Boolean, default=True)
    enabled_at = Column(DateTime, nullable=True)
    disabled_at = Column(DateTime, nullable=True)
    
    # Module-specific settings (overrides default)
    settings = Column(JSONB, default={})
    
    # Usage tracking
    usage_limit = Column(Integer, nullable=True)     # e.g., max students in student module
    current_usage = Column(Integer, default=0)
    
    # Trial
    trial_ends_at = Column(DateTime, nullable=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="modules")
    module = relationship("Module", back_populates="tenant_modules")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'module_id', name='uq_tenant_module'),
    )
    
    def __repr__(self):
        return f"<TenantModule tenant={self.tenant_id} module={self.module_id}>"
    
    @property
    def is_active(self) -> bool:
        """Check if module is currently active for tenant."""
        if not self.is_enabled:
            return False
        if self.trial_ends_at and self.trial_ends_at < datetime.utcnow():
            return False
        return True
    
    @property
    def is_at_limit(self) -> bool:
        """Check if module has reached usage limit."""
        if self.usage_limit is None:
            return False
        return self.current_usage >= self.usage_limit


class RoleModuleAccess(BaseModel):
    """
    Controls which roles have access to which modules.
    Provides granular control over module features per role.
    """
    __tablename__ = "role_module_access"
    
    role_id = Column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    module_id = Column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Access level
    access_level = Column(
        SQLEnum(AccessLevel),
        default=AccessLevel.READ,
        nullable=False
    )
    
    # Specific permissions within module
    allowed_actions = Column(ARRAY(String), default=[])  # Whitelist
    denied_actions = Column(ARRAY(String), default=[])   # Blacklist (takes precedence)
    
    # Feature flags within module
    enabled_features = Column(ARRAY(String), default=[])
    disabled_features = Column(ARRAY(String), default=[])
    
    # Custom restrictions
    restrictions = Column(JSONB, default={})
    
    # Relationships
    role = relationship("Role", back_populates="module_access")
    module = relationship("Module", back_populates="role_access")
    
    __table_args__ = (
        UniqueConstraint('role_id', 'module_id', name='uq_role_module'),
    )
    
    def __repr__(self):
        return f"<RoleModuleAccess role={self.role_id} module={self.module_id}>"
    
    def has_action_access(self, action: str) -> bool:
        """Check if role has access to specific action in module."""
        # Denied actions take precedence
        if action in self.denied_actions:
            return False
        
        # If whitelist exists, action must be in it
        if self.allowed_actions and action not in self.allowed_actions:
            return False
        
        # Check access level
        if self.access_level == AccessLevel.NONE:
            return False
        elif self.access_level == AccessLevel.READ:
            return action in ['read', 'list', 'view', 'get']
        elif self.access_level == AccessLevel.WRITE:
            return action not in ['delete', 'admin', 'configure']
        else:  # ADMIN or FULL
            return True
