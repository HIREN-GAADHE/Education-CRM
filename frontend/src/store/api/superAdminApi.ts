import { apiSlice } from './apiSlice';

export interface TenantStats {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
    total_users: number;
    total_staff?: number;
    total_students?: number;
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

// Inject endpoints into the existing apiSlice (shares auth token handling)
export const superAdminApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getGlobalStats: builder.query<GlobalStats, void>({
            query: () => '/super-admin/stats',
            providesTags: ['Stats' as any],
        }),
        getTenants: builder.query<TenantStats[], void>({
            query: () => '/super-admin/tenants',
            providesTags: ['Tenants' as any],
        }),
        getTenant: builder.query<TenantDetail, string>({
            query: (id) => `/super-admin/tenants/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Tenants' as any, id }],
        }),
        createTenant: builder.mutation<TenantStats, CreateTenantRequest>({
            query: (data) => ({
                url: '/super-admin/tenants',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Tenants' as any, 'Stats' as any],
        }),
        updateTenant: builder.mutation<TenantStats, { id: string; data: UpdateTenantRequest }>({
            query: ({ id, data }) => ({
                url: `/super-admin/tenants/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => ['Tenants' as any, { type: 'Tenants' as any, id }],
        }),
        deleteTenant: builder.mutation<void, string>({
            query: (id) => ({
                url: `/super-admin/tenants/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Tenants' as any, 'Stats' as any],
        }),
        manageAdmin: builder.mutation<{ message: string }, { tenantId: string; data: TenantAdminAction }>({
            query: ({ tenantId, data }) => ({
                url: `/super-admin/tenants/${tenantId}/admin`,
                method: 'POST',
                body: data,
            }),
        }),
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
            invalidatesTags: (_result, _error, { tenantId }) => [{ type: 'Tenants' as any, id: tenantId }],
        }),
        deleteTenantLogo: builder.mutation<void, string>({
            query: (tenantId) => ({
                url: `/super-admin/tenants/${tenantId}/logo`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, tenantId) => [{ type: 'Tenants' as any, id: tenantId }],
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
} = superAdminApiSlice;
