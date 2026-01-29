import React from 'react';
import { usePermission } from '../hooks/usePermission';

interface PermissionGuardProps {
    permission?: string;
    permissions?: string[];
    requireAll?: boolean;
    module?: string;
    minRoleLevel?: number;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Component that renders children only if user has required permissions.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    permission,
    permissions,
    requireAll = true,
    module,
    minRoleLevel,
    fallback = null,
    children,
}) => {
    const {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasModuleAccess,
        hasRoleLevel,
    } = usePermission();

    // Check module access first
    if (module && !hasModuleAccess(module)) {
        return <>{fallback}</>;
    }

    // Check role level
    if (minRoleLevel !== undefined && !hasRoleLevel(minRoleLevel)) {
        return <>{fallback}</>;
    }

    // Check single permission
    if (permission && !hasPermission(permission)) {
        return <>{fallback}</>;
    }

    // Check multiple permissions
    if (permissions && permissions.length > 0) {
        const hasAccess = requireAll
            ? hasAllPermissions(permissions)
            : hasAnyPermission(permissions);

        if (!hasAccess) {
            return <>{fallback}</>;
        }
    }

    return <>{children}</>;
};

/**
 * HOC to wrap a component with permission checking.
 */
export function withPermission<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    options: Omit<PermissionGuardProps, 'children'>
) {
    const WithPermissionComponent: React.FC<P> = (props) => (
        <PermissionGuard {...options}>
            <WrappedComponent {...props} />
        </PermissionGuard>
    );

    WithPermissionComponent.displayName = `WithPermission(${WrappedComponent.displayName || WrappedComponent.name || 'Component'
        })`;

    return WithPermissionComponent;
}

export { usePermission };
