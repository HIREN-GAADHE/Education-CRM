import { apiSlice } from './apiSlice';

// Types
export interface Permission {
    id: string;
    code: string;
    display_name: string;
    resource: string;
    action: string;
    category?: string;
}

export interface ModuleInfo {
    key: string;
    name: string;
    icon: string;
    category: string;
}

export interface Role {
    id: string;
    tenant_id?: string;
    name: string;
    display_name: string;
    description?: string;
    level: number;
    is_system_role: boolean;
    is_tenant_admin: boolean;
    is_default: boolean;
    icon?: string;
    color?: string;
    created_at: string;
    updated_at: string;
    permissions: Permission[];
    allowed_modules: string[];
    user_count: number;
}

export interface RoleListResponse {
    items: Role[];
    total: number;
}

export interface RoleCreateRequest {
    name: string;
    display_name: string;
    description?: string;
    level: number;
    is_default?: boolean;
    icon?: string;
    color?: string;
    permission_ids?: string[];
    allowed_modules?: string[];
}

// Inject endpoints into the centralized apiSlice
export const roleApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getRoles: builder.query<RoleListResponse, void>({
            query: () => '/roles',
            providesTags: ['Roles'],
        }),
        getRole: builder.query<Role, string>({
            query: (id) => `/roles/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Roles', id }],
        }),
        getPermissions: builder.query<Permission[], void>({
            query: () => '/roles/permissions',
            providesTags: ['Permissions'],
        }),
        getModules: builder.query<ModuleInfo[], void>({
            query: () => '/roles/metadata/modules',
            providesTags: ['Modules'],
        }),
        createRole: builder.mutation<Role, RoleCreateRequest>({
            query: (body) => ({
                url: '/roles',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Roles'],
        }),
        updateRole: builder.mutation<Role, { id: string; data: Partial<RoleCreateRequest> }>({
            query: ({ id, data }) => ({
                url: `/roles/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Roles', id }, 'Roles'],
        }),
        deleteRole: builder.mutation<void, string>({
            query: (id) => ({
                url: `/roles/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Roles'],
        }),
    }),
});

export const {
    useGetRolesQuery,
    useGetRoleQuery,
    useGetPermissionsQuery,
    useGetModulesQuery,
    useCreateRoleMutation,
    useUpdateRoleMutation,
    useDeleteRoleMutation,
} = roleApi;
