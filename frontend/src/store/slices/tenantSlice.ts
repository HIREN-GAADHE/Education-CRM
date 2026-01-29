import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { Tenant, Module } from '@/types';

interface TenantState {
    tenant: Tenant | null;
    enabledModules: string[];
    modules: Module[];
    isLoading: boolean;
}

const initialState: TenantState = {
    tenant: null,
    enabledModules: [],
    modules: [],
    isLoading: true,
};

const tenantSlice = createSlice({
    name: 'tenant',
    initialState,
    reducers: {
        setTenant: (state, action: PayloadAction<Tenant>) => {
            state.tenant = action.payload;
            state.isLoading = false;
        },
        setEnabledModules: (state, action: PayloadAction<string[]>) => {
            state.enabledModules = action.payload;
        },
        setModules: (state, action: PayloadAction<Module[]>) => {
            state.modules = action.payload;
        },
        setTenantLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        clearTenant: (state) => {
            state.tenant = null;
            state.enabledModules = [];
            state.modules = [];
            state.isLoading = false;
        },
    },
});

export const {
    setTenant,
    setEnabledModules,
    setModules,
    setTenantLoading,
    clearTenant,
} = tenantSlice.actions;

// Selectors
export const selectTenant = (state: RootState) => state.tenant.tenant;
export const selectEnabledModules = (state: RootState) => state.tenant.enabledModules;
export const selectModules = (state: RootState) => state.tenant.modules;
export const selectTenantLoading = (state: RootState) => state.tenant.isLoading;

export default tenantSlice.reducer;
