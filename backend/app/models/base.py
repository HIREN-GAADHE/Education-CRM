from sqlalchemy import Column, DateTime, Boolean, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.config.database import Base


class TenantMixin:
    """
    Mixin class that adds tenant_id to models for multi-tenancy support.
    All tenant-scoped models should inherit from this.
    """
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,  # Changed to True for development flexibility
        index=True
    )


class TimestampMixin:
    """
    Mixin that adds created_at and updated_at timestamps.
    """
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SoftDeleteMixin:
    """
    Mixin for soft delete functionality.
    """
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True)


class BaseModel(Base):
    """
    Abstract base model with common fields.
    All models should inherit from this.
    """
    __abstract__ = True
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False
    )


class TenantBaseModel(BaseModel, TenantMixin, TimestampMixin):
    """
    Base model for tenant-scoped entities.
    Includes id, tenant_id, and timestamps.
    """
    __abstract__ = True


class AuditableModel(TenantBaseModel, SoftDeleteMixin):
    """
    Full-featured base model with soft delete support.
    Use for entities that need complete audit trail.
    """
    __abstract__ = True
    
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
