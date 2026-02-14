import { apiSlice } from './apiSlice';

// Types - Fixed to match backend response
export interface GradeLevel {
    id: string;
    scale_id: string;
    grade: string;
    min_value: number;  // Fixed: was min_marks
    max_value: number;  // Fixed: was max_marks
    grade_point: number;
    description?: string;
    color?: string;
    order: number;
}

export interface GradeScale {
    id: string;
    tenant_id: string;
    name: string;
    code?: string;
    description?: string;
    scale_type: string;
    academic_year?: string;
    is_default: boolean;
    is_active: boolean;
    levels: GradeLevel[];
    created_at: string;
}

export interface Examination {
    id: string;
    tenant_id: string;
    name: string;
    code?: string;
    description?: string;
    exam_type: 'unit_test' | 'midterm' | 'final' | 'practical' | 'assignment' | 'quiz' | 'oral' | 'internal' | 'project';
    course_id?: string;
    subject_name?: string;  // Added
    class_name?: string;    // Added
    section?: string;       // Added
    academic_year?: string;
    term?: string;          // Added
    exam_date?: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    room_id?: string;
    venue?: string;         // Added
    max_marks: number;
    passing_marks?: number;
    weightage?: number;
    grade_scale_id?: string;
    instructions?: string;
    status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'results_pending' | 'results_published' | 'cancelled';
    created_at: string;
    course?: { id: string; name: string; code: string };
}

export interface ExamResult {
    id: string;
    examination_id: string;
    student_id: string;
    marks_obtained: number | null;
    grade?: string;
    grade_point?: number;
    percentage?: number;
    is_absent: boolean;
    is_exempted: boolean;
    is_passed?: boolean;
    rank?: number;
    exemption_reason?: string;
    remarks?: string;
    verified: boolean;
    created_at: string;
    // Backend returns these fields directly
    student_name?: string;
    student_roll_number?: string;
}

export interface ExamResultCreate {
    student_id: string;
    marks_obtained?: number;
    is_absent?: boolean;
    is_exempted?: boolean;
    exemption_reason?: string;
    remarks?: string;
}

export interface ExamStatistics {
    exam_id: string;
    exam_name: string;
    total_students: number;
    appeared: number;
    absent: number;
    exempted: number;
    passed: number;
    failed: number;
    pass_percentage: number;
    average_marks: number;
    highest_marks: number;
    lowest_marks: number;
    median_marks?: number;
    standard_deviation?: number;
    grade_distribution: Record<string, number>;
    marks_distribution: Array<{ range: string; count: number }>;
}

export interface ExamResultListResponse {
    items: ExamResult[];
    total: number;
    average_marks?: number;
    highest_marks?: number;
    lowest_marks?: number;
    pass_count: number;
    fail_count: number;
    absent_count: number;
}

export interface TranscriptExamEntry {
    exam_name: string;
    exam_type: string;
    subject_name?: string;
    max_marks: number;
    marks_obtained?: number;
    grade?: string;
    grade_point?: number;
    percentage?: number;
    status: string;
}

export interface TranscriptTermEntry {
    term: string;
    exams: TranscriptExamEntry[];
    term_gpa?: number;
    total_marks: number;
    obtained_marks: number;
    percentage: number;
}

export interface TranscriptResponse {
    student_id: string;
    student_name: string;
    student_roll_number?: string;
    class_name?: string;
    section?: string;
    academic_year: string;
    terms: TranscriptTermEntry[];
    overall_gpa?: number;
    cgpa?: number;
    overall_percentage: number;
    overall_grade?: string;
    rank_in_class?: number;
    generated_at: string;
}

export interface StudentGPAResponse {
    student_id: string;
    academic_year: string;
    term?: string;
    gpa?: number;
    cgpa?: number;
    total_credits: number;
    earned_credits: number;
    rank_in_class?: number;
    rank_in_section?: number;
}

export const examinationApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Grade Scales
        getGradeScales: builder.query<{ items: GradeScale[]; total: number }, void>({
            query: () => '/examinations/grade-scales',
            providesTags: ['Examination'],
        }),
        createGradeScale: builder.mutation<GradeScale, { name: string; levels: Omit<GradeLevel, 'id' | 'scale_id'>[]; code?: string; description?: string; scale_type?: string; academic_year?: string; is_default?: boolean }>({
            query: (body) => ({
                url: '/examinations/grade-scales',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Examination'],
        }),

        // Examinations
        getExaminations: builder.query<{ items: Examination[]; total: number; page: number; page_size: number }, { page?: number; pageSize?: number; status?: string; examType?: string; classId?: string; academicYear?: string }>({
            query: ({ page = 1, pageSize = 10, status, examType, classId, academicYear }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (status) params.append('status', status);
                if (examType) params.append('exam_type', examType);
                if (classId) params.append('class_name', classId);
                if (academicYear) params.append('academic_year', academicYear);
                return `/examinations?${params.toString()}`;
            },
            providesTags: ['Examination'],
        }),
        getExamination: builder.query<Examination, string>({
            query: (id) => `/examinations/${id}`,
            providesTags: ['Examination'],
        }),
        createExamination: builder.mutation<Examination, Partial<Examination>>({
            query: (body) => ({
                url: '/examinations',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Examination'],
        }),
        updateExamination: builder.mutation<Examination, { id: string; data: Partial<Examination> }>({
            query: ({ id, data }) => ({
                url: `/examinations/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Examination'],
        }),
        deleteExamination: builder.mutation<void, string>({
            query: (id) => ({
                url: `/examinations/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Examination'],
        }),
        publishResults: builder.mutation<Examination, string>({
            query: (examId) => ({
                url: `/examinations/${examId}/publish`,
                method: 'POST',
            }),
            invalidatesTags: ['Examination'],
        }),

        // Results
        getExamResults: builder.query<ExamResultListResponse, { examinationId: string }>({
            query: ({ examinationId }) => `/examinations/${examinationId}/results`,
            providesTags: ['Examination'],
        }),
        enterResult: builder.mutation<ExamResult, { examinationId: string; data: ExamResultCreate }>({
            query: ({ examinationId, data }) => ({
                url: `/examinations/${examinationId}/results`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Examination'],
        }),
        bulkEnterResults: builder.mutation<{ success: boolean; created: number; updated: number }, { examinationId: string; results: ExamResultCreate[] }>({
            query: ({ examinationId, results }) => ({
                url: `/examinations/${examinationId}/results/bulk`,
                method: 'POST',
                body: { results },
            }),
            invalidatesTags: ['Examination'],
        }),
        deleteResult: builder.mutation<void, { examinationId: string; resultId: string }>({
            query: ({ examinationId, resultId }) => ({
                url: `/examinations/${examinationId}/results/${resultId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Examination'],
        }),

        // Statistics
        getExamStatistics: builder.query<ExamStatistics, string>({
            query: (examinationId) => `/examinations/${examinationId}/statistics`,
        }),

        // Transcript
        getStudentTranscript: builder.query<TranscriptResponse, { studentId: string; academicYear?: string }>({
            query: ({ studentId, academicYear }) => {
                const params = new URLSearchParams();
                if (academicYear) params.append('academic_year', academicYear);
                return `/examinations/students/${studentId}/transcript?${params.toString()}`;
            },
        }),

        // GPA
        calculateGPA: builder.mutation<StudentGPAResponse, { studentId: string; academicYear: string; term?: string }>({
            query: ({ studentId, academicYear, term }) => {
                const params = new URLSearchParams();
                params.append('academic_year', academicYear);
                if (term) params.append('term', term);
                return {
                    url: `/examinations/students/${studentId}/calculate-gpa?${params.toString()}`,
                    method: 'POST',
                };
            },
        }),
    }),
});

export const {
    useGetGradeScalesQuery,
    useCreateGradeScaleMutation,
    useGetExaminationsQuery,
    useGetExaminationQuery,
    useCreateExaminationMutation,
    useUpdateExaminationMutation,
    useDeleteExaminationMutation,
    usePublishResultsMutation,
    useGetExamResultsQuery,
    useEnterResultMutation,
    useBulkEnterResultsMutation,
    useDeleteResultMutation,
    useGetExamStatisticsQuery,
    useGetStudentTranscriptQuery,
    useCalculateGPAMutation,
} = examinationApi;
