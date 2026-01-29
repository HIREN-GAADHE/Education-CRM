from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import BaseModel, TenantBaseModel, TimestampMixin


class RoleLevel(int, enum.Enum):
    """
    Role hierarchy levels.
    Lower number = Higher privilege.
    """
    SUPER_ADMIN = 0        # Platform owner, manages all tenants
    UNIVERSITY_ADMIN = 1   # Institution owner, manages all within tenant
    ADMIN = 2              # Department/Branch admin
    STAFF = 3              # Teachers, accountants, librarians, etc.
    USER = 4               # Students, parents, guests


class Role(TenantBaseModel):
    """
    Role model for role-based access control.
    Roles can be system-defined or tenant-custom.
    """
    __tablename__ = "roles"
    
    # Basic Info
    name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Hierarchy
    level = Column(Integer, nullable=False, default=RoleLevel.USER.value)
    parent_role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)
    
    # Flags
    is_system_role = Column(Boolean, default=False)  # Cannot be modified by tenant
    is_default = Column(Boolean, default=False)      # Assigned to new users by default
    is_tenant_admin = Column(Boolean, default=False) # Has full access to tenant
    is_active = Column(Boolean, default=True)
    
    # Scope restriction
    scope_type = Column(String(50), nullable=True)   # department, branch, course
    
    # UI Configuration
    icon = Column(String(50), default="person")
    color = Column(String(7), default="#666666")
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="roles")
    parent = relationship("Role", remote_side="Role.id", backref="children")
    permissions = relationship("RolePermission", back_populates="role", lazy="dynamic")
    users = relationship("UserRole", back_populates="role", lazy="dynamic")
    module_access = relationship("RoleModuleAccess", back_populates="role", lazy="dynamic")
    
    # Unique constraint for role name per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', name='uq_role_tenant_name'),
    )
    
    def __repr__(self):
        return f"<Role {self.name}>"
    
    def can_manage(self, other_role: "Role") -> bool:
        """Check if this role can manage another role."""
        return self.level < other_role.level


class Permission(BaseModel, TimestampMixin):
    """
    Permission model representing granular access permissions.
    Permissions are resource:action based.
    """
    __tablename__ = "permissions"
    
    # Permission identifier (e.g., "students:create")
    code = Column(String(100), unique=True, nullable=False, index=True)
    
    # Resource-action breakdown
    resource = Column(String(50), nullable=False)  # e.g., "students", "courses"
    action = Column(String(50), nullable=False)    # e.g., "create", "read", "update", "delete"
    
    # Display info
    display_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)   # For grouping in UI
    
    # Module association
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=True)
    
    # Flags
    is_system = Column(Boolean, default=True)      # System permissions cannot be deleted
    requires_tenant_admin = Column(Boolean, default=False)
    requires_super_admin = Column(Boolean, default=False)
    
    # Conditions/constraints
    conditions = Column(JSONB, default={})         # e.g., {"own_department": true}
    
    # Relationships
    module = relationship("Module", back_populates="permissions")
    roles = relationship("RolePermission", back_populates="permission", lazy="dynamic")
    
    __table_args__ = (
        UniqueConstraint('resource', 'action', name='uq_permission_resource_action'),
    )
    
    def __repr__(self):
        return f"<Permission {self.code}>"


class RolePermission(BaseModel):
    """
    Many-to-many relationship between roles and permissions.
    Allows for permission overrides and conditions.
    """
    __tablename__ = "role_permissions"
    
    role_id = Column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False
    )
    permission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Permission modifiers
    granted = Column(Boolean, default=True)        # False = explicitly denied
    conditions = Column(JSONB, default={})         # Additional conditions
    
    # Audit
    granted_by = Column(UUID(as_uuid=True), nullable=True)
    granted_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")
    
    __table_args__ = (
        UniqueConstraint('role_id', 'permission_id', name='uq_role_permission'),
    )
    
    def __repr__(self):
        return f"<RolePermission role={self.role_id} permission={self.permission_id}>"


class UserRole(BaseModel):
    """
    Many-to-many relationship between users and roles.
    Supports scoped role assignments.
    """
    __tablename__ = "user_roles"
    
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role_id = Column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Scope limitation (e.g., role applies only to specific department)
    scope_type = Column(String(50), nullable=True)  # department, branch, course
    scope_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Validity period
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)
    
    # Primary role flag
    is_primary = Column(Boolean, default=False)
    
    # Assignment metadata
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="roles", foreign_keys=[user_id])
    role = relationship("Role", back_populates="users")
    assigner = relationship("User", foreign_keys=[assigned_by])
    
    __table_args__ = (
        UniqueConstraint('user_id', 'role_id', 'scope_type', 'scope_id', name='uq_user_role_scope'),
    )
    
    def __repr__(self):
        return f"<UserRole user={self.user_id} role={self.role_id}>"
    
    @property
    def is_valid(self) -> bool:
        """Check if role assignment is currently valid."""
        now = datetime.utcnow()
        if self.valid_from and self.valid_from > now:
            return False
        if self.valid_until and self.valid_until < now:
            return False
        return True
