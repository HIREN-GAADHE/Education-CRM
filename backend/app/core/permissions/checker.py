from typing import List, Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    User, UserRole, Role, RolePermission, Permission,
    Module, TenantModule, RoleModuleAccess, RoleLevel, AccessLevel
)


class PermissionChecker:
    """
    Service class for checking user permissions.
    Provides methods to validate access at various levels.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_permissions(self, user_id: str, tenant_id: str) -> Set[str]:
        """
        Get all permission codes for a user.
        Aggregates permissions from all assigned roles.
        
        Returns:
            Set of permission codes (e.g., {"students:read", "students:create"})
        """
        # Get all active roles for user
        user_roles = await self._get_user_roles(user_id)
        
        permission_codes = set()
        
        for user_role in user_roles:
            role = user_role.role
            
            # Super admin gets all permissions
            if role.level == RoleLevel.SUPER_ADMIN.value:
                permission_codes.add("*:*")
                return permission_codes
            
            # Tenant admin gets all tenant permissions
            if role.is_tenant_admin:
                permission_codes.add("admin:*")
            
            # Get role permissions
            role_permissions = await self._get_role_permissions(role.id)
            for rp in role_permissions:
                if rp.granted:
                    permission_codes.add(rp.permission.code)
        
        return permission_codes
    
    async def get_user_roles(self, user_id: str) -> List[str]:
        """
        Get all role names for a user.
        
        Returns:
            List of role names
        """
        user_roles = await self._get_user_roles(user_id)
        return [ur.role.name for ur in user_roles if ur.is_valid]
    
    async def get_user_role_level(self, user_id: str) -> int:
        """
        Get the highest privilege level (lowest number) for a user.
        
        Returns:
            Role level (0=Super Admin is highest)
        """
        user_roles = await self._get_user_roles(user_id)
        
        if not user_roles:
            return 99  # No role = lowest privilege
        
        # Return the minimum level (highest privilege)
        return min(ur.role.level for ur in user_roles if ur.is_valid)
    
    async def check_permission(
        self,
        user_id: str,
        resource: str,
        action: str,
        scope_type: Optional[str] = None,
        scope_id: Optional[str] = None
    ) -> bool:
        """
        Check if user has a specific permission.
        
        Args:
            user_id: User UUID
            resource: Resource name
            action: Action name
            scope_type: Optional scope type for scoped permissions
            scope_id: Optional scope ID for scoped permissions
        
        Returns:
            True if user has permission
        """
        permissions = await self.get_user_permissions(user_id, None)
        required = f"{resource}:{action}"
        
        # Direct match
        if required in permissions:
            return True
        
        # Wildcard matches
        if f"{resource}:*" in permissions:
            return True
        
        if "*:*" in permissions:
            return True
        
        if "admin:*" in permissions:
            return True
        
        return False
    
    async def check_module_access(
        self,
        tenant_id: str,
        user_id: str,
        module_code: str
    ) -> bool:
        """
        Check if user has access to a module.
        
        Args:
            tenant_id: Tenant UUID
            user_id: User UUID
            module_code: Module code
        
        Returns:
            True if module is enabled for tenant and user has access
        """
        # Check if module is enabled for tenant
        tenant_module = await self._get_tenant_module(tenant_id, module_code)
        if not tenant_module or not tenant_module.is_active:
            return False
        
        # Get user's roles
        user_roles = await self._get_user_roles(user_id)
        
        for user_role in user_roles:
            # Super/Tenant admin has access to all modules
            if user_role.role.level <= RoleLevel.UNIVERSITY_ADMIN.value:
                return True
            
            # Check role-module access
            access = await self._get_role_module_access(
                user_role.role_id,
                tenant_module.module_id
            )
            if access and access.access_level != AccessLevel.NONE:
                return True
        
        return False
    
    async def get_accessible_modules(
        self,
        tenant_id: str,
        user_id: str
    ) -> List[str]:
        """
        Get list of module codes accessible to user.
        
        Returns:
            List of accessible module codes
        """
        # Get enabled modules for tenant
        tenant_modules = await self._get_tenant_modules(tenant_id)
        
        # Get user's roles
        user_roles = await self._get_user_roles(user_id)
        
        # Check highest role level
        min_level = min(
            (ur.role.level for ur in user_roles if ur.is_valid),
            default=99
        )
        
        # Super/Tenant admin gets all enabled modules
        if min_level <= RoleLevel.UNIVERSITY_ADMIN.value:
            return [tm.module.code for tm in tenant_modules if tm.is_active]
        
        # Check module access for each role
        accessible = set()
        role_ids = [ur.role_id for ur in user_roles if ur.is_valid]
        
        for tm in tenant_modules:
            if not tm.is_active:
                continue
            
            # Core modules are always accessible
            if tm.module.is_core:
                accessible.add(tm.module.code)
                continue
            
            # Check role access
            for role_id in role_ids:
                access = await self._get_role_module_access(role_id, tm.module_id)
                if access and access.access_level != AccessLevel.NONE:
                    accessible.add(tm.module.code)
                    break
        
        return list(accessible)
    
    # Private helper methods
    
    async def _get_user_roles(self, user_id: str) -> List[UserRole]:
        """Get all roles assigned to a user."""
        result = await self.db.execute(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .options(selectinload(UserRole.role))
        )
        return result.scalars().all()
    
    async def _get_role_permissions(self, role_id: str) -> List[RolePermission]:
        """Get all permissions for a role."""
        result = await self.db.execute(
            select(RolePermission)
            .where(RolePermission.role_id == role_id)
            .options(selectinload(RolePermission.permission))
        )
        return result.scalars().all()
    
    async def _get_tenant_module(
        self,
        tenant_id: str,
        module_code: str
    ) -> Optional[TenantModule]:
        """Get tenant-module relationship."""
        result = await self.db.execute(
            select(TenantModule)
            .join(Module)
            .where(
                TenantModule.tenant_id == tenant_id,
                Module.code == module_code
            )
            .options(selectinload(TenantModule.module))
        )
        return result.scalar_one_or_none()
    
    async def _get_tenant_modules(self, tenant_id: str) -> List[TenantModule]:
        """Get all modules for a tenant."""
        result = await self.db.execute(
            select(TenantModule)
            .where(TenantModule.tenant_id == tenant_id)
            .options(selectinload(TenantModule.module))
        )
        return result.scalars().all()
    
    async def _get_role_module_access(
        self,
        role_id: str,
        module_id: str
    ) -> Optional[RoleModuleAccess]:
        """Get role's access to a module."""
        result = await self.db.execute(
            select(RoleModuleAccess)
            .where(
                RoleModuleAccess.role_id == role_id,
                RoleModuleAccess.module_id == module_id
            )
        )
        return result.scalar_one_or_none()
