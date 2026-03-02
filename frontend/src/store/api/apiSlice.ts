import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';
import { logout, updateAccessToken } from '../slices/authSlice';

// ---------------------------------------------------------------------------
// Base queries
// ---------------------------------------------------------------------------

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

// Public base query — no auth header, but keeps credentials (cookie) for refresh
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

// ---------------------------------------------------------------------------
// Token expiry helpers (localStorage, survives page reloads)
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_KEY = 'tokenExpiresAt';

/** Returns true when the token has < thresholdSeconds remaining */
function isTokenExpiringSoon(thresholdSeconds = 120): boolean {
    const raw = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!raw) return false;
    const expiresAt = Number(raw);
    return Date.now() >= expiresAt - thresholdSeconds * 1000;
}

// ---------------------------------------------------------------------------
// Mutex — prevents concurrent refresh races
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(api: any, extraOptions: any): Promise<boolean> {
    try {
        const refreshResult = await publicBaseQuery(
            { url: '/auth/refresh', method: 'POST', body: {} },
            api,
            extraOptions
        );

        if (refreshResult.data) {
            const data = refreshResult.data as { access_token: string; expires_in?: number };
            api.dispatch(updateAccessToken({
                token: data.access_token,
                expiresIn: data.expires_in,
            }));
            return true;
        }

        // Refresh failed (expired cookie, revoked, etc.) — log out
        api.dispatch(logout());
        return false;
    } catch {
        api.dispatch(logout());
        return false;
    }
}

// ---------------------------------------------------------------------------
// Base query with PROACTIVE + REACTIVE token refresh
// ---------------------------------------------------------------------------

const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
    const token = (api.getState() as RootState).auth.accessToken;

    // ── PROACTIVE refresh ────────────────────────────────────────────────────
    // Before making any request: if the token is expiring within 2 minutes,
    // silently refresh it first so the upcoming request uses a fresh token.
    if (token && isTokenExpiringSoon(120)) {
        if (!refreshPromise) {
            refreshPromise = doRefresh(api, extraOptions).finally(() => {
                refreshPromise = null;
            });
        }
        await refreshPromise;
    }

    // ── Make the actual request ──────────────────────────────────────────────
    let result = await baseQuery(args, api, extraOptions);

    // ── REACTIVE refresh on 401 (fallback) ───────────────────────────────────
    // If the server still returns 401 (clock skew, race), attempt refresh once.
    if (result.error && result.error.status === 401) {
        if (!refreshPromise) {
            refreshPromise = doRefresh(api, extraOptions).finally(() => {
                refreshPromise = null;
            });
        }

        const refreshed = await refreshPromise;

        if (refreshed) {
            // Retry the original request with the new token
            result = await baseQuery(args, api, extraOptions);
        }
    }

    return result;
};

// ---------------------------------------------------------------------------
// API slice
// ---------------------------------------------------------------------------

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithReauth,
    tagTypes: [
        'User', 'Users', 'Tenant', 'Roles', 'Permissions', 'Modules',
        'Academic', 'Student', 'Staff', 'Settings', 'PublicTenant',
        'Examination', 'Attendance', 'Timetable', 'Transport',
        'Fees', 'FeeStructures', 'Communication', 'Messages',
        'ReminderSettings', 'ReminderTemplates',
        'PTM', 'HealthRecords', 'DailyDiary', 'Payroll',
    ],
    endpoints: () => ({}),
});
