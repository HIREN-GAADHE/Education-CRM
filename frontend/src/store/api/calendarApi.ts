import { apiSlice } from './apiSlice';

export interface CalendarEvent {
    id: string;
    tenant_id?: string;
    title: string;
    description?: string;
    event_type: string;
    start_datetime: string;
    end_datetime: string;
    all_day: boolean;
    location?: string;
    for_students: boolean;
    for_staff: boolean;
    color: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface EventListResponse {
    items: CalendarEvent[];
    total: number;
}

export interface EventCreateRequest {
    title: string;
    description?: string;
    event_type?: string;
    start_datetime: string;
    end_datetime: string;
    all_day?: boolean;
    location?: string;
    for_students?: boolean;
    for_staff?: boolean;
    color?: string;
    status?: string;
}

export interface EventUpdateRequest {
    title?: string;
    description?: string;
    event_type?: string;
    start_datetime?: string;
    end_datetime?: string;
    all_day?: boolean;
    location?: string;
    for_students?: boolean;
    for_staff?: boolean;
    color?: string;
    status?: string;
}

// Inject endpoints into the centralized apiSlice
export const calendarApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getEvents: builder.query<EventListResponse, { startDate?: string; endDate?: string; eventType?: string }>({
            query: ({ startDate, endDate, eventType }) => {
                const params = new URLSearchParams();
                if (startDate) params.append('start_date', startDate);
                if (endDate) params.append('end_date', endDate);
                if (eventType) params.append('event_type', eventType);
                return `/calendar?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        getEventById: builder.query<CalendarEvent, string>({
            query: (id) => `/calendar/${id}`,
            providesTags: ['Academic'],
        }),
        createEvent: builder.mutation<CalendarEvent, EventCreateRequest>({
            query: (data) => ({
                url: '/calendar',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateEvent: builder.mutation<CalendarEvent, { id: string; data: EventUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/calendar/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteEvent: builder.mutation<void, string>({
            query: (id) => ({
                url: `/calendar/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),
    }),
});

export const {
    useGetEventsQuery,
    useGetEventByIdQuery,
    useCreateEventMutation,
    useUpdateEventMutation,
    useDeleteEventMutation,
} = calendarApi;
