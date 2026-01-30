import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';
import { logout, updateAccessToken } from '../slices/authSlice';

const baseQuery = fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || '/api/v1',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
        const token = (getState() as RootState).auth.accessToken;
        const tenant = (getState() as RootState).tenant.tenant;

        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        if (tenant) {
            headers.set('X-Tenant-ID', tenant.id);
        }

        headers.set('Content-Type', 'application/json');
        return headers;
    },
});

// Public base query without auth headers for public endpoints
export const publicBaseQuery = fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || '/api/v1',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
        const tenant = (getState() as RootState).tenant.tenant;

        if (tenant) {
            headers.set('X-Tenant-ID', tenant.id);
        }

        headers.set('Content-Type', 'application/json');
        return headers;
    },
});

// Base query with token refresh logic
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
    let result = await baseQuery(args, api, extraOptions);

    if (result.error && result.error.status === 401) {
        // Try to refresh the token using HttpOnly cookie
        const refreshResult = await baseQuery(
            {
                url: '/auth/refresh',
                method: 'POST',
                body: {}, // Body is empty, token is in cookie
            },
            api,
            extraOptions
        );

        if (refreshResult.data) {
            const data = refreshResult.data as { access_token: string };
            api.dispatch(updateAccessToken(data.access_token));
            // Retry the original request
            result = await baseQuery(args, api, extraOptions);
        } else {
            api.dispatch(logout());
        }
    }

    return result;
};

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithReauth,
    tagTypes: ['User', 'Users', 'Tenant', 'Roles', 'Permissions', 'Modules', 'Academic', 'Student', 'Staff', 'Settings', 'PublicTenant', 'Examination', 'Attendance', 'Timetable', 'Transport', 'Fees', 'Communication', 'Messages'],
    endpoints: () => ({}),
});
