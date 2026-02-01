import { apiSlice } from './apiSlice';

export interface StudentInfo {
    id: string;
    admission_number: string;
    first_name: string;
    last_name: string;
}

export interface Attendance {
    id: string;
    tenant_id?: string;
    attendance_type: string;
    student_id?: string;
    staff_id?: string;
    attendance_date: string;
    status: string;
    check_in_time?: string;
    check_out_time?: string;
    course?: string;
    section?: string;
    subject?: string;
    remarks?: string;
    created_at: string;
    student?: StudentInfo;
}

export interface AttendanceListResponse {
    items: Attendance[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface AttendanceSummary {
    total_students: number;
    present: number;
    absent: number;
    late: number;
    half_day: number;
    on_leave: number;
    attendance_date: string;
}

export interface AttendanceCreateRequest {
    attendance_type: string;
    student_id?: string;
    staff_id?: string;
    attendance_date: string;
    status: string;
    check_in_time?: string;
    check_out_time?: string;
    course?: string;
    section?: string;
    subject?: string;
    remarks?: string;
}

export interface BulkAttendanceRequest {
    attendance_date: string;
    course?: string;
    section?: string;
    subject?: string;
    records: { student_id: string; status: string; remarks?: string }[];
}

export interface AttendanceUpdateRequest {
    status?: string;
    check_in_time?: string;
    check_out_time?: string;
    remarks?: string;
}

export interface StudentAttendanceHistory {
    student_id: string;
    student_name: string;
    admission_number: string;
    roll_number?: string;
    attendance: Record<string, { status: string; remarks?: string }>;
}

export interface AttendanceHistoryResponse {
    start_date: string;
    end_date: string;
    students: StudentAttendanceHistory[];
}

// Inject endpoints into the centralized apiSlice
export const attendanceApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAttendance: builder.query<AttendanceListResponse, { page?: number; pageSize?: number; attendanceDate?: string; attendanceType?: string; course?: string; section?: string; status?: string }>({
            query: ({ page = 1, pageSize = 20, attendanceDate, attendanceType, course, section, status }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (attendanceDate) params.append('attendance_date', attendanceDate);
                if (attendanceType) params.append('attendance_type', attendanceType);
                if (course) params.append('course', course);
                if (section) params.append('section', section);
                if (status) params.append('status', status);
                return `/attendance?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        getAttendanceHistory: builder.query<AttendanceHistoryResponse, { startDate: string; endDate: string; course: string; section: string; classId?: string }>({
            query: ({ startDate, endDate, course, section, classId }) => {
                const params = new URLSearchParams();
                params.append('start_date', startDate);
                params.append('end_date', endDate);
                params.append('course', course);
                params.append('section', section);
                if (classId) params.append('class_id', classId);
                return `/attendance/history?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        getAttendanceSummary: builder.query<AttendanceSummary, { attendanceDate: string; course?: string; section?: string }>({
            query: ({ attendanceDate, course, section }) => {
                const params = new URLSearchParams();
                params.append('attendance_date', attendanceDate);
                if (course) params.append('course', course);
                if (section) params.append('section', section);
                return `/attendance/summary?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        createAttendance: builder.mutation<Attendance, AttendanceCreateRequest>({
            query: (data) => ({
                url: '/attendance',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        createBulkAttendance: builder.mutation<{ message: string; count: number }, BulkAttendanceRequest>({
            query: (data) => ({
                url: '/attendance/bulk',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateAttendance: builder.mutation<Attendance, { id: string; data: AttendanceUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/attendance/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteAttendance: builder.mutation<void, string>({
            query: (id) => ({
                url: `/attendance/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),
    }),
});

export const {
    useGetAttendanceQuery,
    useGetAttendanceHistoryQuery,
    useGetAttendanceSummaryQuery,
    useCreateAttendanceMutation,
    useCreateBulkAttendanceMutation,
    useUpdateAttendanceMutation,
    useDeleteAttendanceMutation,
} = attendanceApi;
