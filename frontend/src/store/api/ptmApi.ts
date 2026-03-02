import { apiSlice } from './apiSlice';

export interface PTMSlot {
    id: string;
    tenant_id?: string;
    teacher_id: string;
    teacher?: { id: string; first_name: string; last_name: string; designation?: string; department?: string };
    date: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
    notes?: string;
    created_at: string;
}

export interface PTMSlotCreate {
    date: string;
    start_time: string;
    end_time: string;
    notes?: string;
}

export interface PTMSession {
    id: string;
    slot_id?: string;
    teacher_id: string;
    teacher?: { id: string; first_name: string; last_name: string; designation?: string };
    student_id: string;
    student?: { id: string; first_name: string; last_name: string; admission_number: string };
    parent_user_id: string;
    scheduled_at?: string;
    duration_minutes: number;
    status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
    meeting_link?: string;
    reason?: string;
    created_at: string;
}

export interface PTMRemark {
    id: string;
    session_id: string;
    author_user_id: string;
    author_type: 'teacher' | 'parent';
    content: string;
    is_private: boolean;
    created_at: string;
}

const ptmApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getPTMSlots: builder.query<{ items: PTMSlot[]; total: number; page: number; page_size: number; total_pages: number }, { date?: string; teacher_id?: string; available_only?: boolean; page?: number }>({
            query: (params) => ({ url: '/ptm/slots', params }),
            providesTags: ['PTM'],
        }),
        createPTMSlot: builder.mutation<PTMSlot, PTMSlotCreate>({
            query: (data) => ({ url: '/ptm/slots', method: 'POST', body: data }),
            invalidatesTags: ['PTM'],
        }),
        deletePTMSlot: builder.mutation<void, string>({
            query: (id) => ({ url: `/ptm/slots/${id}`, method: 'DELETE' }),
            invalidatesTags: ['PTM'],
        }),
        getPTMSessions: builder.query<{ items: PTMSession[]; total: number }, { status?: string }>({
            query: (params) => ({ url: '/ptm/sessions', params }),
            providesTags: ['PTM'],
        }),
        bookPTMSession: builder.mutation<PTMSession, { slot_id: string; student_id: string; reason?: string }>({
            query: (data) => ({ url: '/ptm/sessions', method: 'POST', body: data }),
            invalidatesTags: ['PTM'],
        }),
        updatePTMSessionStatus: builder.mutation<PTMSession, { id: string; status: string }>({
            query: ({ id, status }) => ({ url: `/ptm/sessions/${id}/status`, method: 'PATCH', body: { status } }),
            invalidatesTags: ['PTM'],
        }),
        getPTMRemarks: builder.query<PTMRemark[], string>({
            query: (sessionId) => `/ptm/sessions/${sessionId}/remarks`,
            providesTags: ['PTM'],
        }),
        addPTMRemark: builder.mutation<PTMRemark, { sessionId: string; content: string; is_private?: boolean }>({
            query: ({ sessionId, ...body }) => ({ url: `/ptm/sessions/${sessionId}/remarks`, method: 'POST', body }),
            invalidatesTags: ['PTM'],
        }),
    }),
});

export const {
    useGetPTMSlotsQuery,
    useCreatePTMSlotMutation,
    useDeletePTMSlotMutation,
    useGetPTMSessionsQuery,
    useBookPTMSessionMutation,
    useUpdatePTMSessionStatusMutation,
    useGetPTMRemarksQuery,
    useAddPTMRemarkMutation,
} = ptmApi;
