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
    errors: StudentImportError[];
    imported_ids: string[];
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
        getStudent: builder.query<Student, string>({
            query: (id) => `/students/${id}`,
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
                }, _api, _extraOptions);

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
    useGetStudentQuery,
    useCreateStudentMutation,
    useUpdateStudentMutation,
    useDeleteStudentMutation,
    useImportStudentsMutation,
    useLazyExportStudentsQuery,
    useLazyDownloadTemplateQuery,
} = studentApi;

