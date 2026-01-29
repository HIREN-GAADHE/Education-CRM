import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    // refreshToken: string | null; // Removed: Managed by HttpOnly cookie
    isAuthenticated: boolean;
    isLoading: boolean;
    roles: string[];
    permissions: string[];
    roleLevel: number;
    restrictedModules: string[];  // Tenant's restricted modules
    allowedModules: string[];  // Role's allowed modules
}

const accessToken = localStorage.getItem('accessToken');
const storedRoleLevel = localStorage.getItem('roleLevel');
const storedRestrictedModules = localStorage.getItem('restrictedModules');
const storedAllowedModules = localStorage.getItem('allowedModules');
const storedUser = localStorage.getItem('user');
const storedRoles = localStorage.getItem('roles');

const initialState: AuthState = {
    user: storedUser ? JSON.parse(storedUser) : null,
    accessToken: accessToken,
    // refreshToken: null, // Removed
    isAuthenticated: !!accessToken,
    isLoading: false,
    roles: storedRoles ? JSON.parse(storedRoles) : [],
    permissions: [],
    roleLevel: storedRoleLevel ? parseInt(storedRoleLevel, 10) : 99,
    restrictedModules: storedRestrictedModules ? JSON.parse(storedRestrictedModules) : [],
    allowedModules: storedAllowedModules ? JSON.parse(storedAllowedModules) : [],
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
                // refreshToken: string; // Removed from payload
                roles: string[];
                permissions: string[];
                roleLevel: number;
                restrictedModules?: string[];
                allowedModules?: string[];
            }>
        ) => {
            const { user, accessToken, roles, permissions, roleLevel, restrictedModules = [], allowedModules = [] } = action.payload;
            state.user = user;
            state.accessToken = accessToken;
            // state.refreshToken = refreshToken; // Removed
            state.isAuthenticated = true;
            state.roles = roles;
            state.permissions = permissions;
            state.roleLevel = roleLevel;
            state.restrictedModules = restrictedModules;
            state.allowedModules = allowedModules;
            state.isLoading = false;

            // Persist to localStorage
            localStorage.setItem('accessToken', accessToken);
            // localStorage.setItem('refreshToken', refreshToken); // Removed
            localStorage.setItem('roleLevel', String(roleLevel));
            localStorage.setItem('restrictedModules', JSON.stringify(restrictedModules));
            localStorage.setItem('allowedModules', JSON.stringify(allowedModules));
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('roles', JSON.stringify(roles));
        },


        updateAccessToken: (state, action: PayloadAction<string>) => {
            state.accessToken = action.payload;
            localStorage.setItem('accessToken', action.payload);
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
            state.isLoading = false;

            // Clear all persisted auth data
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken'); // Ensure removed if exists
            localStorage.removeItem('roleLevel');
            localStorage.removeItem('restrictedModules');
            localStorage.removeItem('allowedModules');
            localStorage.removeItem('user');
            localStorage.removeItem('roles');
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

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectPermissions = (state: RootState) => state.auth.permissions;
export const selectRoles = (state: RootState) => state.auth.roles;
export const selectRoleLevel = (state: RootState) => state.auth.roleLevel;
export const selectRestrictedModules = (state: RootState) => state.auth.restrictedModules;
export const selectAllowedModules = (state: RootState) => state.auth.allowedModules;
export const selectToken = (state: RootState) => state.auth.accessToken;

export default authSlice.reducer;
