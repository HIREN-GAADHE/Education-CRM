import { apiSlice } from './apiSlice';

// Types
export interface ChildSummary {
    id: string;
    admission_number: string;
    full_name: string;
    course?: string;
    section?: string;
    year?: number;
    avatar_url?: string;
    relationship_type: string;
}

export interface AttendanceSummary {
    total_days: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    percentage: number;
}

export interface FeeSummary {
    total_fees: number;
    paid_amount: number;
    pending_amount: number;
    overdue_amount: number;
}

export interface GradeSummary {
    exam_name: string;
    course_name?: string;
    marks_obtained: number;
    max_marks: number;
    percentage: number;
    grade?: string;
    exam_date?: string;
}

export interface StudentDashboard {
    profile_name: string;
    admission_number: string;
    attendance_percentage: number;
    pending_fees: number;
    recent_grades: GradeSummary[];
    upcoming_exams: number;
}

export interface StudentProfile {
    id: string;
    admission_number: string;
    roll_number?: string;
    full_name: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    course?: string;
    department?: string;
    section?: string;
    semester?: number;
    year?: number;
    batch?: string;
    status: string;
    avatar_url?: string;
}

export interface FeeRecord {
    id: string;
    fee_type: string;
    total_amount: number;
    paid_amount: number;
    discount_amount: number;
    balance: number;
    due_date?: string;
    status: string;
    receipt_number?: string;
}

export interface CertificateRecord {
    id: string;
    certificate_type: string;
    certificate_number: string;
    issue_date?: string;
    status: string;
}

// Parent Portal API - Inject endpoints into apiSlice
export const parentPortalApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getChildren: builder.query<ChildSummary[], void>({
            query: () => '/parent/children',
            providesTags: ['User'],
        }),
        getChildProfile: builder.query<any, string>({
            query: (studentId) => `/parent/children/${studentId}/profile`,
            providesTags: ['User'],
        }),
        getChildAttendance: builder.query<AttendanceSummary, string>({
            query: (studentId) => `/parent/children/${studentId}/attendance`,
            providesTags: ['User'],
        }),
        getChildFees: builder.query<FeeSummary, string>({
            query: (studentId) => `/parent/children/${studentId}/fees`,
            providesTags: ['User'],
        }),
        getChildGrades: builder.query<GradeSummary[], string>({
            query: (studentId) => `/parent/children/${studentId}/grades`,
            providesTags: ['User'],
        }),
        getChildTimetable: builder.query<any[], string>({
            query: (studentId) => `/parent/children/${studentId}/timetable`,
            providesTags: ['User'],
        }),
    }),
});

// Student Portal API - Inject endpoints into apiSlice
export const studentPortalApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getStudentDashboard: builder.query<StudentDashboard, void>({
            query: () => '/student/dashboard',
            providesTags: ['User'],
        }),
        getStudentProfile: builder.query<StudentProfile, void>({
            query: () => '/student/profile',
            providesTags: ['User'],
        }),
        getStudentOwnAttendance: builder.query<any[], void>({
            query: () => '/student/attendance',
            providesTags: ['User'],
        }),
        getStudentFees: builder.query<FeeRecord[], void>({
            query: () => '/student/fees',
            providesTags: ['User'],
        }),
        getStudentGrades: builder.query<GradeSummary[], void>({
            query: () => '/student/grades',
            providesTags: ['User'],
        }),
        getStudentCertificates: builder.query<CertificateRecord[], void>({
            query: () => '/student/certificates',
            providesTags: ['User'],
        }),
        getStudentTimetable: builder.query<any[], void>({
            query: () => '/student/timetable',
            providesTags: ['User'],
        }),
    }),
});

// Export hooks
export const {
    useGetChildrenQuery,
    useGetChildProfileQuery,
    useGetChildAttendanceQuery,
    useGetChildFeesQuery,
    useGetChildGradesQuery,
    useGetChildTimetableQuery,
} = parentPortalApi;

export const {
    useGetStudentDashboardQuery,
    useGetStudentProfileQuery,
    useGetStudentOwnAttendanceQuery,
    useGetStudentFeesQuery,
    useGetStudentGradesQuery,
    useGetStudentCertificatesQuery,
    useGetStudentTimetableQuery,
} = studentPortalApi;
