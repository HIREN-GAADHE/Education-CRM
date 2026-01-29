import { apiSlice } from './apiSlice';

// Types
export interface User {
    id: string;
    tenant_id: string;
    email: string;
    username?: string;
    first_name: string;
    last_name: string;
    phone?: string;
    gender?: 'male' | 'female' | 'other';
    status: 'pending' | 'active' | 'inactive' | 'suspended' | 'deleted';
    avatar_url?: string;
    email_verified: boolean;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
    roles: RoleInfo[];
}

export interface RoleInfo {
    id: string;
    name: string;
    display_name: string;
    level: number;
}

export interface UserListResponse {
    items: User[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface UserCreateRequest {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    gender?: string;
    status?: string;
    role_ids?: string[];
}

export interface UserUpdateRequest {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    gender?: string;
    status?: string;
}

// Inject endpoints into the centralized apiSlice
export const userApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getUsers: builder.query<UserListResponse, { page?: number; pageSize?: number; search?: string; status?: string; class_id?: string }>({
            query: ({ page = 1, pageSize = 10, search, status, class_id }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (search) params.append('search', search);
                if (status) params.append('status', status);
                if (class_id) params.append('class_id', class_id);
                return `/users?${params.toString()}`;
            },
            providesTags: ['Users'],
        }),
        getUser: builder.query<User, string>({
            query: (id) => `/users/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'User', id }],
        }),
        createUser: builder.mutation<User, UserCreateRequest>({
            query: (body) => ({
                url: '/users',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Users'],
        }),
        updateUser: builder.mutation<User, { id: string; data: UserUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/users/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }, 'Users'],
        }),
        deleteUser: builder.mutation<void, string>({
            query: (id) => ({
                url: `/users/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Users'],
        }),
        assignRoles: builder.mutation<User, { userId: string; roleIds: string[] }>({
            query: ({ userId, roleIds }) => ({
                url: `/users/${userId}/roles`,
                method: 'POST',
                body: { role_ids: roleIds },
            }),
            invalidatesTags: (_result, _error, { userId }) => [{ type: 'User', id: userId }, 'Users'],
        }),
        updateProfile: builder.mutation<User, UserUpdateRequest>({
            query: (data) => ({
                url: '/users/me',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['User'],
        }),
        userChangePassword: builder.mutation<{ success: boolean; message: string }, { current_password: string; new_password: string }>({
            query: (data) => ({
                url: '/users/me/change-password',
                method: 'POST',
                body: data,
            }),
        }),
    }),
});

export const {
    useGetUsersQuery,
    useGetUserQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
    useAssignRolesMutation,
    useUpdateProfileMutation,
    useUserChangePasswordMutation,
} = userApi;
