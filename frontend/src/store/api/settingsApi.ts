import { apiSlice } from './apiSlice';

// Settings types
export interface AppearanceSettings {
    theme: string | null;
    primary_color: string | null;
    sidebar_collapsed: boolean | null;
    language: string | null;
    timezone: string | null;
}

export interface SystemSettings {
    date_format: string | null;
    time_format: string | null;
    currency: string | null;
    currency_symbol: string | null;
    academic_year: string | null;
    grading_system: string | null;
}

export interface NotificationSettings {
    email_notifications: boolean | null;
    push_notifications: boolean | null;
    sms_alerts: boolean | null;
    weekly_digest: boolean | null;
}

export interface SecuritySettings {
    two_factor_enabled: boolean | null;
    session_timeout_minutes: number | null;
    login_notifications: boolean | null;
    api_access_enabled: boolean | null;
    password_expiry_days: number | null;
}

export interface InstitutionSettings {
    institution_name: string | null;
    institution_logo_url: string | null;
    institution_address: string | null;
    institution_phone: string | null;
    institution_email: string | null;
    institution_website: string | null;
}

export interface SmtpSettings {
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_username: string | null;
    smtp_password: string | null;
    smtp_from_email: string | null;
    smtp_from_name: string | null;
    smtp_security: string | null;
}

export interface AllSettings {
    appearance: AppearanceSettings;
    system: SystemSettings;
    notifications: NotificationSettings;
    security: SecuritySettings;
    institution: InstitutionSettings;
    smtp: SmtpSettings;
}

export interface SettingsUpdateRequest {
    appearance?: Partial<AppearanceSettings>;
    system?: Partial<SystemSettings>;
    notifications?: Partial<NotificationSettings>;
    security?: Partial<SecuritySettings>;
    institution?: Partial<InstitutionSettings>;
    smtp?: Partial<SmtpSettings>;
}

export const settingsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Get all settings
        getSettings: builder.query<AllSettings, void>({
            query: () => '/settings',
            providesTags: ['Settings'],
        }),

        // Update all settings
        updateSettings: builder.mutation<AllSettings, SettingsUpdateRequest>({
            query: (data) => ({
                url: '/settings',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Settings'],
        }),

        // Reset settings to defaults
        resetSettings: builder.mutation<AllSettings, void>({
            query: () => ({
                url: '/settings/reset',
                method: 'POST',
            }),
            invalidatesTags: ['Settings'],
        }),

        // Get appearance settings only
        getAppearanceSettings: builder.query<AppearanceSettings, void>({
            query: () => '/settings/appearance',
            providesTags: ['Settings'],
        }),

        // Update appearance settings
        updateAppearanceSettings: builder.mutation<AppearanceSettings, Partial<AppearanceSettings>>({
            query: (data) => ({
                url: '/settings/appearance',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Settings'],
        }),

        // Get notification settings only
        getNotificationSettings: builder.query<NotificationSettings, void>({
            query: () => '/settings/notifications',
            providesTags: ['Settings'],
        }),

        // Update notification settings
        updateNotificationSettings: builder.mutation<NotificationSettings, Partial<NotificationSettings>>({
            query: (data) => ({
                url: '/settings/notifications',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Settings'],
        }),

        // Get security settings only
        getSecuritySettings: builder.query<SecuritySettings, void>({
            query: () => '/settings/security',
            providesTags: ['Settings'],
        }),

        // Update security settings
        updateSecuritySettings: builder.mutation<SecuritySettings, Partial<SecuritySettings>>({
            query: (data) => ({
                url: '/settings/security',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Settings'],
        }),

        // Get institution settings only
        getInstitutionSettings: builder.query<InstitutionSettings, void>({
            query: () => '/settings/institution',
            providesTags: ['Settings'],
        }),

        // Update institution settings
        updateInstitutionSettings: builder.mutation<InstitutionSettings, Partial<InstitutionSettings>>({
            query: (data) => ({
                url: '/settings/institution',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Settings'],
        }),

        // Upload institution logo
        uploadInstitutionLogo: builder.mutation<string, File>({
            query: (file) => {
                const formData = new FormData();
                formData.append('file', file);
                return {
                    url: '/settings/institution/logo',
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: ['Settings'],
        }),
    }),
});

export const {
    useGetSettingsQuery,
    useUpdateSettingsMutation,
    useResetSettingsMutation,
    useGetAppearanceSettingsQuery,
    useUpdateAppearanceSettingsMutation,
    useGetNotificationSettingsQuery,
    useUpdateNotificationSettingsMutation,
    useGetSecuritySettingsQuery,
    useUpdateSecuritySettingsMutation,
    useGetInstitutionSettingsQuery,
    useUpdateInstitutionSettingsMutation,
    useUploadInstitutionLogoMutation,
} = settingsApi;
