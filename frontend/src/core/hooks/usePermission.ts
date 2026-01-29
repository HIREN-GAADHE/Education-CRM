import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectPermissions, selectRoles, selectRoleLevel } from '@/store/slices/authSlice';
import { selectEnabledModules } from '@/store/slices/tenantSlice';

/**
 * Hook for checking user permissions.
 */
export function usePermission() {
    const permissions = useSelector(selectPermissions);
    const roles = useSelector(selectRoles);
    const roleLevel = useSelector(selectRoleLevel);
    const enabledModules = useSelector(selectEnabledModules);

    /**
     * Check if user has a specific permission.
     */
    const hasPermission = useCallback(
        (permission: string): boolean => {
            // Super admin has all permissions
            if (permissions.includes('*:*') || permissions.includes('admin:*')) {
                return true;
            }

            // Direct match
            if (permissions.includes(permission)) {
                return true;
            }

            // Wildcard match (e.g., "students:*" matches "students:create")
            const [resource] = permission.split(':');
            if (permissions.includes(`${resource}:*`)) {
                return true;
            }

            return false;
        },
        [permissions]
    );

    /**
     * Check if user has any of the specified permissions.
     */
    const hasAnyPermission = useCallback(
        (perms: string[]): boolean => {
            return perms.some((p) => hasPermission(p));
        },
        [hasPermission]
    );

    /**
     * Check if user has all of the specified permissions.
     */
    const hasAllPermissions = useCallback(
        (perms: string[]): boolean => {
            return perms.every((p) => hasPermission(p));
        },
        [hasPermission]
    );

    /**
     * Check if user has access to a module.
     */
    const hasModuleAccess = useCallback(
        (moduleCode: string): boolean => {
            // Super admin has access to all modules
            if (roleLevel <= 1) {
                return true;
            }

            return enabledModules.includes(moduleCode);
        },
        [enabledModules, roleLevel]
    );

    /**
     * Check if user has a specific role.
     */
    const hasRole = useCallback(
        (roleName: string): boolean => {
            return roles.includes(roleName);
        },
        [roles]
    );

    /**
     * Check if user has any of the specified roles.
     */
    const hasAnyRole = useCallback(
        (roleNames: string[]): boolean => {
            return roleNames.some((r) => roles.includes(r));
        },
        [roles]
    );

    /**
     * Check if user's role level is sufficient.
     * Lower number = higher privilege.
     */
    const hasRoleLevel = useCallback(
        (requiredLevel: number): boolean => {
            return roleLevel <= requiredLevel;
        },
        [roleLevel]
    );

    /**
     * Check if user is a super admin.
     */
    const isSuperAdmin = roleLevel === 0;

    /**
     * Check if user is a tenant admin.
     */
    const isTenantAdmin = roleLevel <= 1;

    /**
     * Check if user is an admin.
     */
    const isAdmin = roleLevel <= 2;

    return {
        permissions,
        roles,
        roleLevel,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasModuleAccess,
        hasRole,
        hasAnyRole,
        hasRoleLevel,
        isSuperAdmin,
        isTenantAdmin,
        isAdmin,
    };
}
