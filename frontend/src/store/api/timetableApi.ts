import { apiSlice } from './apiSlice';

// Types - aligned with backend schemas

export type TimeSlotType = 'class' | 'break' | 'lunch' | 'assembly' | 'free' | 'exam';
export type TimetableStatus = 'draft' | 'active' | 'archived';

export interface TimeSlot {
    id: string;
    tenant_id: string;
    name: string;
    code?: string;
    start_time: string;
    end_time: string;
    duration_minutes?: number;
    slot_type: TimeSlotType;
    order: number;
    applicable_days: number[];
    academic_year?: string;
    term?: string;
    is_active: boolean;
    created_at: string;
}

export interface TimeSlotListResponse {
    items: TimeSlot[];
    total: number;
}

export interface TimeSlotCreateRequest {
    name: string;
    code?: string;
    start_time: string;
    end_time: string;
    slot_type?: TimeSlotType;
    order?: number;
    applicable_days?: number[];
    academic_year?: string;
    term?: string;
    is_active?: boolean;
}

export interface Room {
    id: string;
    tenant_id: string;
    name: string;
    code?: string;
    building?: string;
    floor?: string;
    capacity?: number;
    room_type: string;
    facilities: string[];
    is_active: boolean;
    created_at: string;
}

export interface RoomListResponse {
    items: Room[];
    total: number;
}

export interface RoomCreateRequest {
    name: string;
    code?: string;
    building?: string;
    floor?: string;
    capacity?: number;
    room_type?: string;
    facilities?: string[];
    is_active?: boolean;
}

export interface TimetableEntry {
    id: string;
    tenant_id: string;
    time_slot_id: string;
    day_of_week: number;
    course_id?: string;
    subject_name?: string;
    teacher_id?: string;
    room_id?: string;
    class_name?: string;
    section?: string;
    academic_year?: string;
    term?: string;
    status: TimetableStatus;
    notes?: string;
    created_at: string;
    time_slot?: TimeSlot;
    room?: Room;
    course?: { id: string; name: string; code: string };
    teacher?: { id: string; first_name: string; last_name: string };
}

export interface TimetableEntryListResponse {
    items: TimetableEntry[];
    total: number;
}

export interface TimetableEntryCreateRequest {
    time_slot_id: string;
    day_of_week: number;
    course_id?: string;
    subject_name?: string;
    teacher_id?: string;
    room_id?: string;
    class_name?: string;
    section?: string;
    academic_year?: string;
    term?: string;
    effective_from?: string;
    effective_until?: string;
    notes?: string;
}

export interface TimetableGridCell {
    entry_id?: string;
    subject_name?: string;
    teacher_name?: string;
    room_name?: string;
    slot_type: string;
    is_empty: boolean;
}

export interface TimetableGridRow {
    time_slot: TimeSlot;
    cells: Record<number, TimetableGridCell>;
}

export interface TimetableGridResponse {
    class_name?: string;
    section?: string;
    teacher_id?: string;
    academic_year?: string;
    rows: TimetableGridRow[];
    days: number[];
    time_slots: TimeSlot[];
}

export interface ConflictCheckRequest {
    time_slot_id: string;
    day_of_week: number;
    teacher_id?: string;
    room_id?: string;
    class_name?: string;
    section?: string;
    academic_year?: string;
    exclude_entry_id?: string;
}

export interface ConflictResponse {
    has_conflict: boolean;
    conflicts: {
        type: string;
        message: string;
        entry_id?: string;
    }[];
    message: string;
}

// Inject endpoints into the centralized apiSlice
export const timetableApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Time Slots
        getTimeSlots: builder.query<TimeSlotListResponse, { academicYear?: string; activeOnly?: boolean } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.academicYear) searchParams.append('academic_year', params.academicYear);
                // Explicitly send active_only value - backend defaults to true if not sent
                searchParams.append('active_only', params?.activeOnly === false ? 'false' : 'true');
                const queryString = searchParams.toString();
                return `/timetable/time-slots${queryString ? `?${queryString}` : ''}`;
            },
            providesTags: ['Academic'],
        }),
        createTimeSlot: builder.mutation<TimeSlot, TimeSlotCreateRequest>({
            query: (body) => ({
                url: '/timetable/time-slots',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateTimeSlot: builder.mutation<TimeSlot, { id: string; data: Partial<TimeSlotCreateRequest> }>({
            query: ({ id, data }) => ({
                url: `/timetable/time-slots/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteTimeSlot: builder.mutation<void, string>({
            query: (id) => ({
                url: `/timetable/time-slots/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),

        // Rooms
        getRooms: builder.query<RoomListResponse, { roomType?: string; activeOnly?: boolean } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.roomType) searchParams.append('room_type', params.roomType);
                // Explicitly send active_only value - backend defaults to true if not sent
                searchParams.append('active_only', params?.activeOnly === false ? 'false' : 'true');
                const queryString = searchParams.toString();
                return `/timetable/rooms${queryString ? `?${queryString}` : ''}`;
            },
            providesTags: ['Academic'],
        }),
        createRoom: builder.mutation<Room, RoomCreateRequest>({
            query: (body) => ({
                url: '/timetable/rooms',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateRoom: builder.mutation<Room, { id: string; data: Partial<RoomCreateRequest> }>({
            query: ({ id, data }) => ({
                url: `/timetable/rooms/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteRoom: builder.mutation<void, string>({
            query: (id) => ({
                url: `/timetable/rooms/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),

        // Timetable Entries
        getTimetableEntries: builder.query<TimetableEntryListResponse, {
            className?: string;
            section?: string;
            teacherId?: string;
            roomId?: string;
            day?: number;
            academicYear?: string;
        } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.className) searchParams.append('class_name', params.className);
                if (params?.section) searchParams.append('section', params.section);
                if (params?.teacherId) searchParams.append('teacher_id', params.teacherId);
                if (params?.roomId) searchParams.append('room_id', params.roomId);
                if (params?.day) searchParams.append('day', params.day.toString());
                if (params?.academicYear) searchParams.append('academic_year', params.academicYear);
                const queryString = searchParams.toString();
                return `/timetable/entries${queryString ? `?${queryString}` : ''}`;
            },
            providesTags: ['Academic'],
        }),
        createTimetableEntry: builder.mutation<TimetableEntry, TimetableEntryCreateRequest>({
            query: (body) => ({
                url: '/timetable/entries',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateTimetableEntry: builder.mutation<TimetableEntry, { id: string; data: Partial<TimetableEntryCreateRequest> }>({
            query: ({ id, data }) => ({
                url: `/timetable/entries/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteTimetableEntry: builder.mutation<void, string>({
            query: (id) => ({
                url: `/timetable/entries/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),

        // Grid View
        getTimetableGrid: builder.query<TimetableGridResponse, {
            className?: string;
            section?: string;
            teacherId?: string;
            academicYear?: string;
        } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.className) searchParams.append('class_name', params.className);
                if (params?.section) searchParams.append('section', params.section);
                if (params?.teacherId) searchParams.append('teacher_id', params.teacherId);
                if (params?.academicYear) searchParams.append('academic_year', params.academicYear);
                const queryString = searchParams.toString();
                return `/timetable/grid${queryString ? `?${queryString}` : ''}`;
            },
            providesTags: ['Academic'],
        }),

        // Conflict Check
        checkConflicts: builder.mutation<ConflictResponse, ConflictCheckRequest>({
            query: (body) => ({
                url: '/timetable/check-conflicts',
                method: 'POST',
                body,
            }),
        }),

        // Teacher Schedule
        getTeacherSchedule: builder.query<TimetableEntryListResponse, { teacherId: string; academicYear?: string }>({
            query: ({ teacherId, academicYear }) => {
                const params = academicYear ? `?academic_year=${academicYear}` : '';
                return `/timetable/teacher/${teacherId}/schedule${params}`;
            },
            providesTags: ['Academic'],
        }),

        // Room Schedule
        getRoomSchedule: builder.query<TimetableEntryListResponse, { roomId: string; academicYear?: string }>({
            query: ({ roomId, academicYear }) => {
                const params = academicYear ? `?academic_year=${academicYear}` : '';
                return `/timetable/room/${roomId}/schedule${params}`;
            },
            providesTags: ['Academic'],
        }),
        downloadTimetableTemplate: builder.query<Blob, void>({
            query: () => ({
                url: '/timetable/template',
                responseHandler: (response: Response) => response.blob(),
            }),
        }),
        importTimetable: builder.mutation<any, FormData>({
            query: (formData) => ({
                url: '/timetable/import',
                method: 'POST',
                body: formData,
            }),
        }),
        exportTimetable: builder.query<Blob, void>({
            query: () => ({
                url: '/timetable/export',
                responseHandler: (response: Response) => response.blob(),
            }),
        }),
    }),
});

export const {
    useGetTimeSlotsQuery,
    useCreateTimeSlotMutation,
    useUpdateTimeSlotMutation,
    useDeleteTimeSlotMutation,
    useGetRoomsQuery,
    useCreateRoomMutation,
    useUpdateRoomMutation,
    useDeleteRoomMutation,
    useGetTimetableEntriesQuery,
    useCreateTimetableEntryMutation,
    useUpdateTimetableEntryMutation,
    useDeleteTimetableEntryMutation,
    useGetTimetableGridQuery,
    useCheckConflictsMutation,
    useGetTeacherScheduleQuery,
    useGetRoomScheduleQuery,
    useLazyDownloadTimetableTemplateQuery,
    useImportTimetableMutation,
    useLazyExportTimetableQuery,
} = timetableApi;
