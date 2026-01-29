import { apiSlice } from './apiSlice';

export interface ReportType {
    value: string;
    label: string;
    description: string;
    icon: string;
    category: string;
}

export interface Report {
    id: string;
    tenant_id?: string;
    name: string;
    description?: string;
    report_type: string;
    parameters: Record<string, any>;
    format: string;
    file_url?: string;
    file_size?: number;
    status: string;
    error_message?: string;
    generated_by?: string;
    generated_at?: string;
    data: Record<string, any>;
    row_count: number;
    created_at: string;
    updated_at: string;
}

export interface ReportListResponse {
    items: Report[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ReportCreateRequest {
    name: string;
    description?: string;
    report_type: string;
    parameters?: Record<string, any>;
    format?: string;
    start_date?: string;
    end_date?: string;
    selected_fields?: Record<string, string[]>;
}

export interface FieldInfo {
    key: string;
    label: string;
    type: string;
}

export interface EntityFields {
    label: string;
    fields: FieldInfo[];
}

export interface AvailableFields {
    students: EntityFields;
    staff: EntityFields;
    fees: EntityFields;
    messages: EntityFields;
}

export interface QuickStats {
    total_students: number;
    total_staff: number;
    total_fee_collected: number;
    total_fee_pending: number;
    attendance_rate: number;
    active_courses: number;
    recent_admissions: number;
    pending_messages: number;
}

// Inject endpoints into the centralized apiSlice
export const reportApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getQuickStats: builder.query<QuickStats, void>({
            query: () => '/reports/quick-stats',
            providesTags: ['Academic'],
        }),
        getReportTypes: builder.query<ReportType[], void>({
            query: () => '/reports/types',
        }),
        getAvailableFields: builder.query<AvailableFields, void>({
            query: () => '/reports/available-fields',
        }),
        getReports: builder.query<ReportListResponse, { page?: number; pageSize?: number; reportType?: string; status?: string }>({
            query: ({ page = 1, pageSize = 10, reportType, status }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (reportType) params.append('report_type', reportType);
                if (status) params.append('status', status);
                return `/reports?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        getReport: builder.query<Report, string>({
            query: (id) => `/reports/${id}`,
            providesTags: ['Academic'],
        }),
        generateReport: builder.mutation<Report, ReportCreateRequest>({
            query: (data) => ({
                url: '/reports',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteReport: builder.mutation<void, string>({
            query: (id) => ({
                url: `/reports/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),
    }),
});

export const {
    useGetQuickStatsQuery,
    useGetReportTypesQuery,
    useGetAvailableFieldsQuery,
    useGetReportsQuery,
    useGetReportQuery,
    useGenerateReportMutation,
    useDeleteReportMutation,
} = reportApi;
