import { apiSlice } from './apiSlice';

export interface TenantStats {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
    total_users: number;
    total_staff: number;
    total_students: number;
    restricted_modules?: string[];
    logo_url?: string;
    domain?: string;
}

export interface UpdateTenantRequest {
    name?: string;
    status?: string;
    domain?: string;
    is_active?: boolean;
    restricted_modules?: string[];
}

export interface TenantDetail extends TenantStats {
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    plan_id?: string;
    features: string[];
    active_users?: number;
    total_revenue?: number;
}

export interface TenantAdminAction {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    action: 'create' | 'reset-password';
}

export interface GlobalStats {
    total_tenants: number;
    active_tenants: number;
    total_users_platform: number;
    total_students_platform: number;
    total_staff_platform: number;
    total_revenue_platform: number;
    system_health?: string;
}

export interface CreateTenantRequest {
    name: string;
    slug: string;
    email: string;
    admin_email: string;
    admin_password: string;
    admin_first_name: string;
    admin_last_name: string;
    domain?: string;
    plan_id?: string;
    features?: string[];
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
}

export interface TenantUserItem {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    status: string;
    role_name?: string;
    role_level?: number;
    created_at?: string;
    last_login?: string;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    level: string;
    action: string;
    user_email: string;
    tenant_name?: string;
    details: string;
    ip_address?: string;
}

export interface PlatformSettings {
    platform_name: string;
    support_email: string;
    maintenance_mode: boolean;
    allow_new_registrations: boolean;
    default_plan: string;
    max_students_per_tenant: number;
    max_staff_per_tenant: number;
}

export interface ImpersonationResponse {
    access_token: string;
    token_type: string;
    user_email: string;
    user_name: string;
    tenant_id: string;
    role: string;
    expires_in_minutes: number;
    message: string;
}

// Inject endpoints into the existing apiSlice
export const superAdminApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Stats
        getGlobalStats: builder.query<GlobalStats, void>({
            query: () => '/super-admin/stats',
            providesTags: ['Tenant'],
        }),

        // Tenants
        getTenants: builder.query<TenantStats[], void>({
            query: () => '/super-admin/tenants',
            providesTags: ['Tenant'],
        }),
        getTenant: builder.query<TenantDetail, string>({
            query: (id) => `/super-admin/tenants/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Tenant' as const, id }],
        }),
        createTenant: builder.mutation<TenantStats, CreateTenantRequest>({
            query: (data) => ({
                url: '/super-admin/tenants',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Tenant'],
        }),
        updateTenant: builder.mutation<TenantStats, { id: string; data: UpdateTenantRequest }>({
            query: ({ id, data }) => ({
                url: `/super-admin/tenants/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => ['Tenant', { type: 'Tenant' as const, id }],
        }),
        deleteTenant: builder.mutation<void, string>({
            query: (id) => ({
                url: `/super-admin/tenants/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Tenant'],
        }),

        // Admin management
        manageAdmin: builder.mutation<{ message: string }, { tenantId: string; data: TenantAdminAction }>({
            query: ({ tenantId, data }) => ({
                url: `/super-admin/tenants/${tenantId}/admin`,
                method: 'POST',
                body: data,
            }),
        }),

        // Logo
        uploadTenantLogo: builder.mutation<{ logo_url: string }, { tenantId: string; file: File }>({
            query: ({ tenantId, file }) => {
                const formData = new FormData();
                formData.append('file', file);
                return {
                    url: `/super-admin/tenants/${tenantId}/logo`,
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: (_result, _error, { tenantId }) => [{ type: 'Tenant' as const, id: tenantId }],
        }),
        deleteTenantLogo: builder.mutation<void, string>({
            query: (tenantId) => ({
                url: `/super-admin/tenants/${tenantId}/logo`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, tenantId) => [{ type: 'Tenant' as const, id: tenantId }],
        }),

        // Cross-tenant user management
        getTenantUsers: builder.query<TenantUserItem[], { tenantId: string; page?: number; pageSize?: number }>({
            query: ({ tenantId, page = 1, pageSize = 50 }) =>
                `/super-admin/tenants/${tenantId}/users?page=${page}&page_size=${pageSize}`,
            providesTags: (_result, _error, { tenantId }) => [{ type: 'Tenant' as const, id: tenantId }],
        }),

        // Platform settings
        getPlatformSettings: builder.query<PlatformSettings, void>({
            query: () => '/super-admin/settings',
            providesTags: ['Settings'],
        }),
        updatePlatformSettings: builder.mutation<PlatformSettings, PlatformSettings>({
            query: (data) => ({
                url: '/super-admin/settings',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Settings'],
        }),

        // Audit logs
        getAuditLogs: builder.query<AuditLogEntry[], { page?: number; pageSize?: number }>({
            query: ({ page = 1, pageSize = 50 }) =>
                `/super-admin/audit-logs?page=${page}&page_size=${pageSize}`,
        }),

        // Impersonation
        impersonateUser: builder.mutation<ImpersonationResponse, string>({
            query: (userId) => ({
                url: `/super-admin/impersonate/${userId}`,
                method: 'POST',
            }),
        }),
    }),
});

export const {
    useGetGlobalStatsQuery,
    useGetTenantsQuery,
    useGetTenantQuery,
    useCreateTenantMutation,
    useUpdateTenantMutation,
    useDeleteTenantMutation,
    useManageAdminMutation,
    useUploadTenantLogoMutation,
    useDeleteTenantLogoMutation,
    useGetTenantUsersQuery,
    useGetPlatformSettingsQuery,
    useUpdatePlatformSettingsMutation,
    useGetAuditLogsQuery,
    useImpersonateUserMutation,
} = superAdminApiSlice;
