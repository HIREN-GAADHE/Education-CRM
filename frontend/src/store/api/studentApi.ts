import { apiSlice } from './apiSlice';

// Types
export interface Student {
    id: string;
    tenant_id: string;
    admission_number: string;
    roll_number?: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    blood_group?: string;
    email?: string;
    phone?: string;
    course?: string;
    department?: string;
    batch?: string;
    section?: string;
    class_id?: string;
    semester?: number;
    year?: number;
    status: 'applicant' | 'enrolled' | 'active' | 'suspended' | 'graduated' | 'dropped' | 'transferred';
    avatar_url?: string;
    father_name?: string;
    father_phone?: string;
    mother_name?: string;
    mother_phone?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    admission_date?: string;
    created_at: string;
    updated_at: string;

    // Extended fields
    alternate_phone?: string;
    address_line2?: string;
    country?: string;
    parent_email?: string;
    father_occupation?: string;
    mother_occupation?: string;
    guardian_name?: string;
    guardian_phone?: string;
    guardian_relation?: string;
    category?: string;
    nationality?: string;
}

export interface StudentListResponse {
    items: Student[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface StudentCreateRequest {
    admission_number: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    blood_group?: string;
    category?: string;
    nationality?: string;
    email?: string;
    phone?: string;
    alternate_phone?: string;
    course?: string;
    department?: string;
    batch?: string;
    status?: string;
    class_id?: string;

    // Address
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;

    // Family
    parent_email?: string;
    father_name?: string;
    father_phone?: string;
    father_occupation?: string;
    mother_name?: string;
    mother_phone?: string;
    mother_occupation?: string;
    guardian_name?: string;
    guardian_phone?: string;
    guardian_relation?: string;

    [key: string]: any;
}

export interface StudentImportError {
    row: number;
    field?: string;
    message: string;
}

export interface StudentImportResult {
    total_rows: number;
    successful: number;
    failed: number;
    imported: number;
    updated: number;
    fees_created: number;
    errors: StudentImportError[];
    imported_ids: string[];
}

// Student Profile Types
export interface EnrollmentJourney {
    admission_date: string | null;
    admission_type: string | null;
    current_status: string;
    days_enrolled: number;
    months_enrolled?: number;
    years_enrolled?: number;
    batch: string | null;
    expected_graduation: string | null;
    current_semester?: number | string | null;
    course?: string | null;
    department?: string | null;
    class_name?: string | null;
    section?: string | null;
    roll_number?: string | null;
    academic_year?: string | null;
    milestones?: { title: string; date: string; type: string }[];
    status_history: { status: string; date: string }[];
}

export interface AttendanceSummary {
    total_days: number;
    present: number;
    absent: number;
    late: number;
    half_day: number;
    on_leave: number;
    attendance_percentage: number;
}

export interface ExamResult {
    exam_name: string;
    subject: string;
    marks_obtained: number | null;
    max_marks: number;
    percentage: number | null;
    grade: string | null;
    is_passed: boolean | null;
    rank: number | null;
    exam_date: string | null;
}

export interface ExamSummary {
    total_exams?: number;
    exams_taken: number;
    exams_passed: number;
    average_percentage: number;
    average_grade_point: number;
    pass_percentage?: number;
    recent_results: ExamResult[];
}

export interface FeePaymentItem {
    id: string;
    fee_type: string;
    total_amount: number;
    amount_paid: number;
    due_date: string | null;
    status: string;
}

export interface FeeSummary {
    total_fees: number;
    paid: number;
    pending: number;
    payment_percentage: number;
    recent_payments: FeePaymentItem[];
}

export interface AcademicProgress {
    current_year: number | null;
    current_semester: number | null;
    course: string | null;
    department: string | null;
    cgpa: number;
    class: { id: string; name: string; section: string } | null;
}

export interface StudentProfileData {
    id: string;
    admission_number: string;
    roll_number: string | null;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    full_name: string;
    date_of_birth: string | null;
    gender: string | null;
    blood_group: string | null;
    email: string | null;
    phone: string | null;
    alternate_phone: string | null;
    nationality: string | null;
    category: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    avatar_url: string | null;
    father_name: string | null;
    father_phone: string | null;
    father_occupation: string | null;
    mother_name: string | null;
    mother_phone: string | null;
    mother_occupation: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    guardian_relation: string | null;
    parent_email: string | null;
    status: string;
    course?: string | null;
    department?: string | null;
    created_at: string;
}

export interface StudentProfile {
    student: StudentProfileData;
    enrollment_journey: EnrollmentJourney;
    attendance_summary: AttendanceSummary;
    exam_summary: ExamSummary;
    fee_summary: FeeSummary;
    academic_progress: AcademicProgress;
}


// Inject endpoints into the centralized apiSlice
export const studentApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getStudents: builder.query<StudentListResponse, { page?: number; pageSize?: number; search?: string; status?: string; course?: string; class_id?: string }>({
            query: ({ page = 1, pageSize = 10, search, status, course, class_id }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (search) params.append('search', search);
                if (status) params.append('status', status);
                if (course) params.append('course', course);
                if (class_id) params.append('class_id', class_id);
                return `/students?${params.toString()}`;
            },
            providesTags: ['Student'],
        }),
        getAllStudents: builder.query<{ id: string; first_name: string; last_name: string; admission_number: string }[], void>({
            query: () => '/students/all',
            providesTags: ['Student'],
        }),
        getStudent: builder.query<Student, string>({
            query: (id) => `/students/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Student', id }],
        }),
        getStudentProfile: builder.query<StudentProfile, string>({
            query: (id) => `/students/${id}/profile`,
            providesTags: (_result, _error, id) => [{ type: 'Student', id }],
        }),
        createStudent: builder.mutation<Student, StudentCreateRequest>({
            query: (body) => ({
                url: '/students',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Student'],
        }),
        updateStudent: builder.mutation<Student, { id: string; data: Partial<StudentCreateRequest> }>({
            query: ({ id, data }) => ({
                url: `/students/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Student', id }, 'Student'],
        }),
        bulkDeleteStudents: builder.mutation<void, string[]>({
            query: (ids) => ({
                url: '/students/bulk',
                method: 'DELETE',
                body: ids,
            }),
            invalidatesTags: ['Student'],
        }),
        deleteStudent: builder.mutation<void, string>({
            query: (id) => ({
                url: `/students/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Student'],
        }),
        importStudents: builder.mutation<StudentImportResult, FormData>({
            query: (formData) => ({
                url: '/students/import',
                method: 'POST',
                body: formData,
            }),
            invalidatesTags: ['Student'],
        }),
        exportStudents: builder.query<Blob, { format: 'csv' | 'excel'; search?: string; status?: string; course?: string; class_id?: string }>({
            queryFn: async ({ format, search, status, course, class_id }, _api, _extraOptions, baseQuery) => {
                const params = new URLSearchParams();
                params.append('format', format);
                if (search) params.append('search', search);
                if (status) params.append('status', status);
                if (course) params.append('course', course);
                if (class_id) params.append('class_id', class_id);

                const result = await baseQuery({
                    url: `/students/export?${params.toString()}`,
                    responseHandler: async (response: Response) => {
                        if (!response.ok) {
                            // Parse error as JSON
                            return response.json();
                        }
                        // Return blob for successful responses
                        return response.blob();
                    },
                });

                if (result.error) {
                    return { error: result.error };
                }

                return { data: result.data as Blob };
            },
            keepUnusedDataFor: 0,
        }),
        downloadTemplate: builder.query<Blob, void>({
            queryFn: async (_arg, _api, _extraOptions, baseQuery) => {
                const result = await baseQuery({
                    url: '/students/template',
                    responseHandler: async (response: Response) => {
                        if (!response.ok) {
                            // Parse error as JSON
                            return response.json();
                        }
                        // Return blob for successful responses
                        return response.blob();
                    },
                });

                if (result.error) {
                    return { error: result.error };
                }

                return { data: result.data as Blob };
            },
            keepUnusedDataFor: 0,
        }),
    }),
});

export const {
    useGetStudentsQuery,
    useGetAllStudentsQuery,
    useGetStudentQuery,
    useGetStudentProfileQuery,
    useCreateStudentMutation,
    useUpdateStudentMutation,
    useDeleteStudentMutation,
    useBulkDeleteStudentsMutation,
    useImportStudentsMutation,
    useLazyExportStudentsQuery,
    useLazyDownloadTemplateQuery,
} = studentApi;

