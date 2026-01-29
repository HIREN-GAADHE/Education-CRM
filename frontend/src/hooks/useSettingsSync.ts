import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '@/store/slices/authSlice';
import { syncAppearanceSettings } from '@/store/slices/uiSlice';
import { useGetSettingsQuery } from '@/store/api/settingsApi';

/**
 * Hook to sync settings from backend on app load.
 * Should be called once when user is authenticated.
 * Syncs appearance settings (theme, primary_color, sidebar_collapsed) to Redux.
 */
export function useSettingsSync() {
    const dispatch = useDispatch();
    const user = useSelector(selectUser);
    const hasSynced = useRef(false);

    // Only fetch settings if user is authenticated
    const { data: settings, isSuccess } = useGetSettingsQuery(undefined, {
        skip: !user,
    });

    // Sync settings to Redux when loaded
    useEffect(() => {
        if (isSuccess && settings && !hasSynced.current) {
            hasSynced.current = true;

            // Only sync appearanc settings from backend if NOT already in localStorage
            // This preserves navbar toggle changes that haven't been saved to backend yet
            const existingTheme = localStorage.getItem('theme');
            const existingPrimaryColor = localStorage.getItem('primaryColor');
            const existingSidebarCollapsed = localStorage.getItem('sidebarCollapsed');

            dispatch(syncAppearanceSettings({
                // Only use backend theme if not already set in localStorage
                theme: existingTheme ? undefined : (settings.appearance.theme as 'light' | 'dark' | undefined),
                // Only use backend primary color if not already set
                primaryColor: existingPrimaryColor || settings.appearance.primary_color || undefined,
                // Only use backend sidebar collapsed if not already set
                sidebarCollapsed: existingSidebarCollapsed !== null ? undefined : settings.appearance.sidebar_collapsed ?? undefined,
                // Always sync institution details
                institutionName: settings.institution?.institution_name || undefined,
                institutionLogoUrl: settings.institution?.institution_logo_url || undefined,
            }));
        }
    }, [isSuccess, settings, dispatch]);

    // Reset sync flag when user changes (logout/login)
    useEffect(() => {
        if (!user) {
            hasSynced.current = false;
        }
    }, [user]);

    return { settings, isLoading: !isSuccess && !!user };
}

export default useSettingsSync;
