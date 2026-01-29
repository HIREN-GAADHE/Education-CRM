"""
Audit Logging Service - Track important actions for compliance and debugging.
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID as UUIDType, uuid4
from datetime import datetime
from typing import Optional, Any, Dict
import enum
import logging

from app.models.base import BaseModel
from app.core.utils import utc_now


logger = logging.getLogger(__name__)


class AuditAction(str, enum.Enum):
    """Types of auditable actions."""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    FAILED_LOGIN = "failed_login"
    PASSWORD_CHANGE = "password_change"
    PERMISSION_CHANGE = "permission_change"
    EXPORT = "export"
    IMPORT = "import"


class AuditLog(BaseModel):
    """
    Audit log entry for tracking important actions.
    """
    __tablename__ = "audit_logs"
    
    # Who
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)  # Denormalized for quick lookups
    
    # What
    action = Column(SQLEnum(AuditAction), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)  # e.g., "student", "attendance"
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    resource_name = Column(String(255), nullable=True)  # Human-readable identifier
    
    # Details
    old_value = Column(JSONB, nullable=True)  # Previous state
    new_value = Column(JSONB, nullable=True)  # New state
    changes = Column(JSONB, nullable=True)  # Diff of changes
    
    # Context
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(50), nullable=True)  # From RequestIDMiddleware
    
    # Additional metadata (renamed from 'metadata' which is reserved)
    extra_data = Column(JSONB, default={})
    
    # Timestamp (use timezone-aware)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)


class AuditService:
    """
    Service for creating audit log entries.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def log(
        self,
        action: AuditAction,
        resource_type: str,
        resource_id: Optional[UUIDType] = None,
        user_id: Optional[UUIDType] = None,
        tenant_id: Optional[UUIDType] = None,
        user_email: Optional[str] = None,
        resource_name: Optional[str] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.
        """
        # Calculate changes if both old and new values provided
        changes = None
        if old_value and new_value:
            changes = self._calculate_changes(old_value, new_value)
        
        entry = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            tenant_id=tenant_id,
            user_id=user_id,
            user_email=user_email,
            resource_name=resource_name,
            old_value=old_value,
            new_value=new_value,
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            extra_data=extra_data or {},
            timestamp=utc_now(),
        )
        
        self.db.add(entry)
        # Don't commit here - let the caller manage the transaction
        
        logger.info(
            f"Audit: {action.value} {resource_type} "
            f"(id={resource_id}) by user={user_id}"
        )
        
        return entry
    
    def _calculate_changes(
        self, 
        old_value: Dict[str, Any], 
        new_value: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate the diff between old and new values."""
        changes = {}
        all_keys = set(old_value.keys()) | set(new_value.keys())
        
        for key in all_keys:
            old_val = old_value.get(key)
            new_val = new_value.get(key)
            if old_val != new_val:
                changes[key] = {
                    "old": old_val,
                    "new": new_val
                }
        
        return changes
    
    async def log_login(
        self,
        user_id: UUIDType,
        tenant_id: UUIDType,
        user_email: str,
        ip_address: str,
        user_agent: str,
        success: bool = True,
        request_id: Optional[str] = None,
    ) -> AuditLog:
        """Log a login attempt."""
        return await self.log(
            action=AuditAction.LOGIN if success else AuditAction.FAILED_LOGIN,
            resource_type="session",
            user_id=user_id,
            tenant_id=tenant_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            extra_data={"success": success}
        )
    
    async def log_crud(
        self,
        action: AuditAction,
        resource_type: str,
        resource_id: UUIDType,
        user_id: UUIDType,
        tenant_id: UUIDType,
        old_value: Optional[Dict] = None,
        new_value: Optional[Dict] = None,
        request_id: Optional[str] = None,
    ) -> AuditLog:
        """Convenience method for CRUD operations."""
        return await self.log(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            tenant_id=tenant_id,
            old_value=old_value,
            new_value=new_value,
            request_id=request_id,
        )


# Dependency for routes
async def get_audit_service(db: AsyncSession) -> AuditService:
    """Get audit service instance."""
    return AuditService(db)
