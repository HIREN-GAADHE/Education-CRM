import { apiSlice } from './apiSlice';
import type { LoginRequest, LoginResponse, User } from '@/types';

export const authApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        login: builder.mutation<LoginResponse, LoginRequest>({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials,
            }),
        }),
        logout: builder.mutation<void, void>({
            query: () => ({
                url: '/auth/logout',
                method: 'POST',
            }),
        }),
        refreshToken: builder.mutation<{ access_token: string }, void>({
            query: () => ({
                url: '/auth/refresh',
                method: 'POST',
            }),
        }),
        getCurrentUser: builder.query<User, void>({
            query: () => '/users/me',
            providesTags: ['User'],
        }),
        changePassword: builder.mutation<
            { success: boolean },
            { current_password: string; new_password: string; confirm_password: string }
        >({
            query: (body) => ({
                url: '/users/me/change-password',
                method: 'POST',
                body,
            }),
        }),
        forgotPassword: builder.mutation<{ success: boolean }, { email: string }>({
            query: (body) => ({
                url: '/auth/forgot-password',
                method: 'POST',
                body,
            }),
        }),
        resetPassword: builder.mutation<
            { success: boolean },
            { token: string; password: string; confirm_password: string }
        >({
            query: (body) => ({
                url: '/auth/reset-password',
                method: 'POST',
                body,
            }),
        }),
    }),
});

export const {
    useLoginMutation,
    useLogoutMutation,
    useRefreshTokenMutation,
    useGetCurrentUserQuery,
    useChangePasswordMutation,
    useForgotPasswordMutation,
    useResetPasswordMutation,
} = authApiSlice;
