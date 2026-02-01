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

// Mutex to prevent multiple refresh requests
let refreshPromise: Promise<{ access_token: string } | null> | null = null;

// Base query with token refresh logic
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
    let result = await baseQuery(args, api, extraOptions);

    if (result.error && result.error.status === 401) {
        if (!refreshPromise) {
            console.log('Token expired, starting refresh...');
            refreshPromise = (async () => {
                try {
                    const refreshResult = await publicBaseQuery(
                        {
                            url: '/auth/refresh',
                            method: 'POST',
                            body: {},
                        },
                        api,
                        extraOptions
                    );

                    if (refreshResult.data) {
                        const data = refreshResult.data as { access_token: string };
                        console.log('Token refreshed successfully');
                        api.dispatch(updateAccessToken(data.access_token));
                        return data;
                    } else {
                        console.log('Refresh failed, logging out');
                        api.dispatch(logout());
                        return null;
                    }
                } catch (e) {
                    api.dispatch(logout());
                    return null;
                } finally {
                    refreshPromise = null;
                }
            })();
        }

        await refreshPromise;

        // After refresh (success or fail), retry. 
        // Ideally checking if we have a token now.
        const token = (api.getState() as RootState).auth.accessToken;
        if (token) {
            result = await baseQuery(args, api, extraOptions);
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
