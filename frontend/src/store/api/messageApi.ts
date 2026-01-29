import { apiSlice } from './apiSlice';

export interface Message {
    id: string;
    tenant_id?: string;
    sender_id?: string;
    sender_name?: string;
    sender_email?: string;
    recipient_id?: string;
    recipient_name?: string;
    recipient_email?: string;
    recipient_type?: string;
    subject: string;
    body: string;
    priority: string;
    status: string;
    sent_at?: string;
    read_at?: string;
    is_starred: boolean;
    is_important: boolean;
    parent_id?: string;
    created_at: string;
    updated_at: string;
}

export interface MessageListResponse {
    items: Message[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    unread_count: number;
}

export interface MessageCreateRequest {
    recipient_id?: string;
    recipient_name?: string;
    recipient_email?: string;
    recipient_type?: string;
    subject: string;
    body: string;
    priority?: string;
    is_important?: boolean;
    class_ids?: string[];
    recipient_roles?: string[];
}

export interface MessageUpdateRequest {
    status?: string;
    is_starred?: boolean;
    is_important?: boolean;
}

// Bulk messaging types
export interface BulkMessageRequest {
    class_ids: string[];
    recipient_roles: string[];
    subject: string;
    body: string;
    priority?: string;
    is_important?: boolean;
}

export interface RecipientCountRequest {
    class_ids: string[];
    recipient_roles: string[];
}

export interface RecipientCountResponse {
    students: number;
    parents: number;
    teachers: number;
    total: number;
}

export interface BulkMessageResponse {
    success: boolean;
    message: string;
    created: number;
    failed: number;
    errors: { recipient: string; error: string }[];
}

// Inject endpoints into the centralized apiSlice
export const messageApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMessages: builder.query<MessageListResponse, { page?: number; pageSize?: number; folder?: string; search?: string }>({
            query: ({ page = 1, pageSize = 20, folder = 'inbox', search }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                params.append('folder', folder);
                if (search) params.append('search', search);
                return `/messages?${params.toString()}`;
            },
            providesTags: ['User'],
        }),
        getMessage: builder.query<Message, string>({
            query: (id) => `/messages/${id}`,
            providesTags: ['User'],
        }),
        sendMessage: builder.mutation<Message, MessageCreateRequest>({
            query: (data) => ({
                url: '/messages',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['User'],
        }),
        updateMessage: builder.mutation<Message, { id: string; data: MessageUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/messages/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['User'],
        }),
        replyToMessage: builder.mutation<Message, { id: string; body: string }>({
            query: ({ id, body }) => ({
                url: `/messages/${id}/reply`,
                method: 'POST',
                body: { body, subject: '' },
            }),
            invalidatesTags: ['User'],
        }),
        deleteMessage: builder.mutation<void, string>({
            query: (id) => ({
                url: `/messages/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['User'],
        }),
        markAllAsRead: builder.mutation<{ success: boolean; marked_count: number }, void>({
            query: () => ({
                url: '/messages/mark-all-read',
                method: 'POST',
            }),
            invalidatesTags: ['User'],
        }),
        clearAllNotifications: builder.mutation<{ success: boolean; cleared_count: number }, void>({
            query: () => ({
                url: '/messages/clear-all',
                method: 'POST',
            }),
            invalidatesTags: ['User'],
        }),
        getUnreadCount: builder.query<{ unread_count: number }, void>({
            query: () => '/messages/unread-count',
            providesTags: ['User'],
        }),
        getRecipientCount: builder.mutation<RecipientCountResponse, RecipientCountRequest>({
            query: (data) => ({
                url: '/messages/recipient-count',
                method: 'POST',
                body: data,
            }),
        }),
        sendBulkMessages: builder.mutation<BulkMessageResponse, BulkMessageRequest>({
            query: (data) => ({
                url: '/messages/bulk',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['User'],
        }),
    }),
});

export const {
    useGetMessagesQuery,
    useGetMessageQuery,
    useSendMessageMutation,
    useUpdateMessageMutation,
    useReplyToMessageMutation,
    useDeleteMessageMutation,
    useMarkAllAsReadMutation,
    useClearAllNotificationsMutation,
    useGetUnreadCountQuery,
    useGetRecipientCountMutation,
    useSendBulkMessagesMutation,
} = messageApi;
