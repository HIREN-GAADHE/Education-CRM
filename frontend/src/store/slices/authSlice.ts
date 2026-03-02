import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    roles: string[];
    permissions: string[];
    roleLevel: number;
    restrictedModules: string[];  // Tenant's restricted modules
    allowedModules: string[];  // Role's allowed modules
    tokenExpiresAt: number | null;  // Unix ms timestamp of access token expiry
}

const accessToken = localStorage.getItem('accessToken');
const storedRoleLevel = localStorage.getItem('roleLevel');
const storedRestrictedModules = localStorage.getItem('restrictedModules');
const storedAllowedModules = localStorage.getItem('allowedModules');
const storedUser = localStorage.getItem('user');
const storedRoles = localStorage.getItem('roles');
const storedTokenExpiresAt = localStorage.getItem('tokenExpiresAt');

const initialState: AuthState = {
    user: storedUser ? JSON.parse(storedUser) : null,
    accessToken: accessToken,
    isAuthenticated: !!accessToken,
    isLoading: false,
    roles: storedRoles ? JSON.parse(storedRoles) : [],
    permissions: [],
    roleLevel: storedRoleLevel ? parseInt(storedRoleLevel, 10) : 99,
    restrictedModules: storedRestrictedModules ? JSON.parse(storedRestrictedModules) : [],
    allowedModules: storedAllowedModules ? JSON.parse(storedAllowedModules) : [],
    tokenExpiresAt: storedTokenExpiresAt ? Number(storedTokenExpiresAt) : null,
};


const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (
            state,
            action: PayloadAction<{
                user: User;
                accessToken: string;
                roles: string[];
                permissions: string[];
                roleLevel: number;
                restrictedModules?: string[];
                allowedModules?: string[];
                expiresIn?: number;  // Server-provided seconds until token expiry
            }>
        ) => {
            const { user, accessToken, roles, permissions, roleLevel, restrictedModules = [], allowedModules = [], expiresIn } = action.payload;
            state.user = user;
            state.accessToken = accessToken;
            state.isAuthenticated = true;
            state.roles = roles;
            state.permissions = permissions;
            state.roleLevel = roleLevel;
            state.restrictedModules = restrictedModules;
            state.allowedModules = allowedModules;
            state.isLoading = false;

            // Compute and store token expiry
            const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
            state.tokenExpiresAt = expiresAt;

            // Persist to localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('roleLevel', String(roleLevel));
            localStorage.setItem('restrictedModules', JSON.stringify(restrictedModules));
            localStorage.setItem('allowedModules', JSON.stringify(allowedModules));
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('roles', JSON.stringify(roles));
            if (expiresAt) localStorage.setItem('tokenExpiresAt', String(expiresAt));
        },


        updateAccessToken: (state, action: PayloadAction<{ token: string; expiresIn?: number }>) => {
            state.accessToken = action.payload.token;
            localStorage.setItem('accessToken', action.payload.token);
            if (action.payload.expiresIn) {
                const expiresAt = Date.now() + action.payload.expiresIn * 1000;
                state.tokenExpiresAt = expiresAt;
                localStorage.setItem('tokenExpiresAt', String(expiresAt));
            }
        },
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
        },
        setRoles: (state, action: PayloadAction<string[]>) => {
            state.roles = action.payload;
        },
        setPermissions: (state, action: PayloadAction<string[]>) => {
            state.permissions = action.payload;
        },
        setRoleLevel: (state, action: PayloadAction<number>) => {
            state.roleLevel = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        logout: (state) => {
            state.user = null;
            state.accessToken = null;
            // state.refreshToken = null; // Removed
            state.isAuthenticated = false;
            state.roles = [];
            state.permissions = [];
            state.roleLevel = 99;
            state.restrictedModules = [];
            state.allowedModules = [];
            state.tokenExpiresAt = null;
            state.isLoading = false;

            // Clear all persisted auth data
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken'); // Ensure removed if exists
            localStorage.removeItem('roleLevel');
            localStorage.removeItem('restrictedModules');
            localStorage.removeItem('allowedModules');
            localStorage.removeItem('user');
            localStorage.removeItem('roles');
            localStorage.removeItem('tokenExpiresAt');
        },

    },
});

export const {
    setCredentials,
    updateAccessToken,
    setUser,
    setRoles,
    setPermissions,
    setRoleLevel,
    setLoading,
    logout,
} = authSlice.actions;

export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectPermissions = (state: RootState) => state.auth.permissions;
export const selectRoles = (state: RootState) => state.auth.roles;
export const selectRoleLevel = (state: RootState) => state.auth.roleLevel;
export const selectRestrictedModules = (state: RootState) => state.auth.restrictedModules;
export const selectAllowedModules = (state: RootState) => state.auth.allowedModules;
export const selectToken = (state: RootState) => state.auth.accessToken;
export const selectTokenExpiresAt = (state: RootState) => state.auth.tokenExpiresAt;

export default authSlice.reducer;
