import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircularProgress, Box } from '@mui/material';
import { selectIsAuthenticated, selectAuth } from '@/store/slices/authSlice';
import { usePermission } from './PermissionGuard';
import { useSettingsSync } from '@/hooks/useSettingsSync';

interface ProtectedRouteProps {
    children: React.ReactNode;
    permission?: string;
    permissions?: string[];
    requireAll?: boolean;
    module?: string;
    minRoleLevel?: number;
    redirectTo?: string;
}

/**
 * Route wrapper that requires authentication and optionally specific permissions.
 * Also syncs settings from backend on initial load.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    permission,
    permissions,
    requireAll = true,
    module,
    minRoleLevel,
    redirectTo = '/login',
}) => {
    const location = useLocation();
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const { isLoading } = useSelector(selectAuth);
    const {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasModuleAccess,
        hasRoleLevel,
    } = usePermission();

    // Sync settings from backend to Redux on authentication
    useSettingsSync();

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Check module access
    if (module && !hasModuleAccess(module)) {
        return <Navigate to="/forbidden" replace />;
    }

    // Check role level
    if (minRoleLevel !== undefined && !hasRoleLevel(minRoleLevel)) {
        return <Navigate to="/forbidden" replace />;
    }

    // Check single permission
    if (permission && !hasPermission(permission)) {
        return <Navigate to="/forbidden" replace />;
    }

    // Check multiple permissions
    if (permissions && permissions.length > 0) {
        const hasAccess = requireAll
            ? hasAllPermissions(permissions)
            : hasAnyPermission(permissions);

        if (!hasAccess) {
            return <Navigate to="/forbidden" replace />;
        }
    }

    return <>{children}</>;
};

/**
 * Route wrapper for public routes (login, register, etc.)
 * Redirects to dashboard if already authenticated.
 */
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const { isLoading } = useSelector(selectAuth);

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};
