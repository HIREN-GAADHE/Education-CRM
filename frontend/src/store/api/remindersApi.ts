import { apiSlice } from './apiSlice';

export interface ReminderSettings {
    id: string;
    tenant_id: string;
    auto_reminders_enabled: boolean;
    reminder_days_before: number[];
    reminder_days_after: number[];
    email_enabled: boolean;
    sms_enabled: boolean;
    in_app_enabled: boolean;
    escalation_enabled: boolean;
    escalation_days: number[];
    monthly_reminder_enabled: boolean;
    monthly_reminder_day: number;
    monthly_reminder_template_id?: string;
}

export interface ReminderTemplate {
    id: string;
    name: string;
    type: 'email' | 'sms' | 'in_app';
    subject?: string;
    body: string;
    is_active: boolean;
    is_default: boolean;
}

export interface SendReminderRequest {
    student_ids: string[];
    fee_payment_ids?: string[];
    channels: ('email' | 'sms' | 'in_app')[];
    template_id?: string;
    custom_message?: string;
}

export interface BulkSendRequest {
    filters: {
        class_id?: string;
        department?: string;
        academic_year?: string;
        status?: string;
    };
    exclude_student_ids?: string[];
    channels: ('email' | 'sms' | 'in_app')[];
    template_id?: string;
    custom_message?: string;
}

export interface SendReceiptRequest {
    payment_id: string;
    channels: ('email' | 'sms' | 'in_app')[];
}

export const remindersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getReminderSettings: builder.query<ReminderSettings, void>({
            query: () => '/reminders/settings',
            providesTags: ['ReminderSettings'],
        }),
        updateReminderSettings: builder.mutation<ReminderSettings, Partial<ReminderSettings>>({
            query: (body) => ({
                url: '/reminders/settings',
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['ReminderSettings'],
        }),
        getReminderTemplates: builder.query<ReminderTemplate[], void>({
            query: () => '/reminders/templates',
            providesTags: ['ReminderTemplates'],
        }),
        sendReminders: builder.mutation<void, SendReminderRequest>({
            query: (body) => ({
                url: '/reminders/send',
                method: 'POST',
                body,
            }),
        }),
        bulkSendReminders: builder.mutation<{ message: string }, BulkSendRequest>({
            query: (body) => ({
                url: '/reminders/bulk-send',
                method: 'POST',
                body,
            }),
        }),
        sendReceipt: builder.mutation<void, SendReceiptRequest>({
            query: (body) => ({
                url: '/reminders/receipt',
                method: 'POST',
                body,
            }),
        }),
    }),
});

export const {
    useGetReminderSettingsQuery,
    useUpdateReminderSettingsMutation,
    useGetReminderTemplatesQuery,
    useSendRemindersMutation,
    useBulkSendRemindersMutation,
    useSendReceiptMutation,
} = remindersApi;
