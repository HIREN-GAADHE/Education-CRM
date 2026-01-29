import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

interface UiState {
    sidebarOpen: boolean;
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark';
    primaryColor: string;
    isMobile: boolean;
    pageTitle: string;
    breadcrumbs: Array<{ label: string; path?: string }>;
    isLoading: boolean;
    institutionName: string;
    institutionLogoUrl: string | null;
}

const initialState: UiState = {
    sidebarOpen: true,
    sidebarCollapsed: (localStorage.getItem('sidebarCollapsed') === 'true') || false,
    theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
    primaryColor: localStorage.getItem('primaryColor') || '#667eea',
    isMobile: window.innerWidth < 768,
    pageTitle: 'Dashboard',
    breadcrumbs: [],
    isLoading: false,
    institutionName: localStorage.getItem('institutionName') || 'EduERP',
    institutionLogoUrl: localStorage.getItem('institutionLogoUrl'),
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSidebarOpen: (state, action: PayloadAction<boolean>) => {
            state.sidebarOpen = action.payload;
        },
        toggleSidebarCollapse: (state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
        },
        setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
            state.sidebarCollapsed = action.payload;
            localStorage.setItem('sidebarCollapsed', String(action.payload));
        },
        setPrimaryColor: (state, action: PayloadAction<string>) => {
            state.primaryColor = action.payload;
            localStorage.setItem('primaryColor', action.payload);
        },
        setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
            state.theme = action.payload;
            localStorage.setItem('theme', action.payload);
        },
        toggleTheme: (state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            state.theme = newTheme;
            localStorage.setItem('theme', newTheme);
        },
        setIsMobile: (state, action: PayloadAction<boolean>) => {
            state.isMobile = action.payload;
            if (action.payload) {
                state.sidebarOpen = false;
            }
        },
        setPageTitle: (state, action: PayloadAction<string>) => {
            state.pageTitle = action.payload;
            document.title = `${action.payload} | ${state.institutionName}`;
        },
        setBreadcrumbs: (
            state,
            action: PayloadAction<Array<{ label: string; path?: string }>>
        ) => {
            state.breadcrumbs = action.payload;
        },
        setGlobalLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setInstitutionDetails: (state, action: PayloadAction<{ name?: string; logoUrl?: string | null }>) => {
            if (action.payload.name) {
                state.institutionName = action.payload.name;
                localStorage.setItem('institutionName', action.payload.name);
            }
            if (action.payload.logoUrl !== undefined) {
                state.institutionLogoUrl = action.payload.logoUrl;
                if (action.payload.logoUrl) {
                    localStorage.setItem('institutionLogoUrl', action.payload.logoUrl);
                } else {
                    localStorage.removeItem('institutionLogoUrl');
                }
            }
        },
        // Sync all settings at once from backend
        syncAppearanceSettings: (state, action: PayloadAction<{
            theme?: 'light' | 'dark';
            primaryColor?: string;
            sidebarCollapsed?: boolean;
            institutionName?: string;
            institutionLogoUrl?: string | null;
        }>) => {
            const { theme, primaryColor, sidebarCollapsed, institutionName, institutionLogoUrl } = action.payload;
            if (theme) {
                state.theme = theme;
                localStorage.setItem('theme', theme);
            }
            if (primaryColor) {
                state.primaryColor = primaryColor;
                localStorage.setItem('primaryColor', primaryColor);
            }
            if (sidebarCollapsed !== undefined) {
                state.sidebarCollapsed = sidebarCollapsed;
                localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
            }
            if (institutionName) {
                state.institutionName = institutionName;
                localStorage.setItem('institutionName', institutionName);
            }
            if (institutionLogoUrl !== undefined) {
                state.institutionLogoUrl = institutionLogoUrl;
                if (institutionLogoUrl) {
                    localStorage.setItem('institutionLogoUrl', institutionLogoUrl);
                } else {
                    localStorage.removeItem('institutionLogoUrl');
                }
            }
        },
    },
});

export const {
    toggleSidebar,
    setSidebarOpen,
    toggleSidebarCollapse,
    setSidebarCollapsed,
    setPrimaryColor,
    setTheme,
    toggleTheme,
    setIsMobile,
    setPageTitle,
    setBreadcrumbs,
    setGlobalLoading,
    syncAppearanceSettings,
    setInstitutionDetails,
} = uiSlice.actions;

// Selectors
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen;
export const selectSidebarCollapsed = (state: RootState) => state.ui.sidebarCollapsed;
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectPrimaryColor = (state: RootState) => state.ui.primaryColor;
export const selectIsMobile = (state: RootState) => state.ui.isMobile;
export const selectPageTitle = (state: RootState) => state.ui.pageTitle;
export const selectBreadcrumbs = (state: RootState) => state.ui.breadcrumbs;
export const selectGlobalLoading = (state: RootState) => state.ui.isLoading;
export const selectInstitutionName = (state: RootState) => state.ui.institutionName;
export const selectInstitutionLogoUrl = (state: RootState) => state.ui.institutionLogoUrl;

export default uiSlice.reducer;
