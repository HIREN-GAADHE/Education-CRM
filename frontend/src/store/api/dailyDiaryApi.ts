import { apiSlice } from './apiSlice';

export type MoodType = 'happy' | 'neutral' | 'sad' | 'angry' | 'anxious' | 'excited';

export interface DiaryEntry {
    id: string;
    student_id: string;
    student?: { id: string; first_name: string; last_name: string; admission_number: string };
    teacher_id?: string;
    teacher?: { id: string; first_name: string; last_name: string };
    entry_date: string;
    mood?: MoodType;
    behavior_score?: number;
    attendance_status?: string;
    academic_notes?: string;
    behavior_notes?: string;
    homework_status?: string;
    homework_notes?: string;
    is_shared_with_parent: boolean;
    parent_acknowledged: boolean;
    created_at: string;
}

export interface DiaryCreate {
    student_id: string;
    entry_date: string;
    mood?: string;
    behavior_score?: number;
    attendance_status?: string;
    academic_notes?: string;
    behavior_notes?: string;
    homework_status?: string;
    homework_notes?: string;
    is_shared_with_parent?: boolean;
}

export interface MoodSummary {
    student_id: string;
    period_days: number;
    total_entries: number;
    mood_distribution: Record<string, number>;
    avg_behavior_score?: number;
}

const dailyDiaryApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getDiaryEntries: builder.query<{ items: DiaryEntry[]; total: number; total_pages: number }, { student_id?: string; date_from?: string; date_to?: string; page?: number; page_size?: number }>({
            query: (params) => ({ url: '/daily-diary', params }),
            providesTags: ['DailyDiary'],
        }),
        createDiaryEntry: builder.mutation<DiaryEntry, DiaryCreate>({
            query: (data) => ({ url: '/daily-diary', method: 'POST', body: data }),
            invalidatesTags: ['DailyDiary'],
        }),
        updateDiaryEntry: builder.mutation<DiaryEntry, { id: string; data: Partial<DiaryCreate> }>({
            query: ({ id, data }) => ({ url: `/daily-diary/${id}`, method: 'PATCH', body: data }),
            invalidatesTags: ['DailyDiary'],
        }),
        acknowledgeDiaryEntry: builder.mutation<DiaryEntry, string>({
            query: (id) => ({ url: `/daily-diary/${id}/acknowledge`, method: 'PATCH' }),
            invalidatesTags: ['DailyDiary'],
        }),
        getMoodSummary: builder.query<MoodSummary, { studentId: string; days?: number }>({
            query: ({ studentId, days = 30 }) => `/daily-diary/student/${studentId}/summary?days=${days}`,
            providesTags: ['DailyDiary'],
        }),
    }),
});

export const {
    useGetDiaryEntriesQuery,
    useCreateDiaryEntryMutation,
    useUpdateDiaryEntryMutation,
    useAcknowledgeDiaryEntryMutation,
    useGetMoodSummaryQuery,
} = dailyDiaryApi;
