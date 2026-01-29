import { apiSlice } from './apiSlice';

export interface DashboardStats {
    total_students: number;
    total_staff: number;
    active_courses: number;
    fee_collection: number;
    students_change?: string;
    staff_change?: string;
    courses_change?: string;
    fee_change?: string;
}

export interface DepartmentAttendance {
    label: string;
    value: number;
    color: string;
}

export interface ScheduleEvent {
    time: string;
    event: string;
    type: string;
    color: string;
}

export interface Notification {
    title: string;
    time: string;
    type: string;
}

export interface RecentStudent {
    id: string;
    name: string;
    admission_number: string;
    created_at: string;
}

export interface RecentPayment {
    id: string;
    amount: number;
    date: string;
    student_name: string;
}

export interface DashboardResponse {
    stats: DashboardStats;
    attendance: DepartmentAttendance[];
    schedule: ScheduleEvent[];
    notifications: Notification[];
    recent_students: RecentStudent[];
    recent_payments: RecentPayment[];
}

// Inject endpoints into the centralized apiSlice
export const dashboardApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getDashboardData: builder.query<DashboardResponse, void>({
            query: () => '/dashboard',
            providesTags: ['Academic'],
        }),
        getDashboardQuickStats: builder.query<{ students: number; staff: number; courses: number }, void>({
            query: () => '/dashboard/stats',
            providesTags: ['Academic'],
        }),
    }),
});

export const {
    useGetDashboardDataQuery,
    useGetDashboardQuickStatsQuery,
} = dashboardApi;
