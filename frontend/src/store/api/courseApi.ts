import { apiSlice } from './apiSlice';

export interface Course {
    id: string;
    tenant_id?: string;
    code: string;
    name: string;
    description?: string;
    department?: string;
    category?: string;
    duration_months?: number;
    credits?: number;
    max_students?: number;
    enrolled_count?: number;
    fee_amount?: number;
    status: 'active' | 'inactive' | 'upcoming' | 'completed' | 'archived';
    progress?: number;
    instructor_name?: string;
    start_date?: string;
    end_date?: string;
    is_mandatory: boolean;
    color?: string;
}

export interface CourseListResponse {
    items: Course[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface CourseCreateRequest {
    code: string;
    name: string;
    description?: string;
    department?: string;
    category?: string;
    duration_months?: number;
    credits?: number;
    max_students?: number;
    fee_amount?: number;
    status?: string;
    instructor_name?: string;
    start_date?: string;
    end_date?: string;
    is_mandatory?: boolean;
    color?: string;
}

export interface CourseUpdateRequest extends Partial<CourseCreateRequest> {
    enrolled_count?: number;
    progress?: number;
}

// Inject endpoints into the centralized apiSlice
export const courseApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getCourses: builder.query<CourseListResponse, { page?: number; pageSize?: number; page_size?: number; search?: string; department?: string; status?: string }>({
            query: ({ page = 1, pageSize, page_size, search, department, status }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', (pageSize || page_size || 10).toString());
                if (search) params.append('search', search);
                if (department) params.append('department', department);
                if (status) params.append('status', status);
                return `/courses?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        getCourse: builder.query<Course, string>({
            query: (id) => `/courses/${id}`,
            providesTags: ['Academic'],
        }),
        createCourse: builder.mutation<Course, CourseCreateRequest>({
            query: (data) => ({
                url: '/courses',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateCourse: builder.mutation<Course, { id: string; data: CourseUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/courses/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteCourse: builder.mutation<void, string>({
            query: (id) => ({
                url: `/courses/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),
        getDepartments: builder.query<{ departments: string[] }, void>({
            query: () => '/courses/stats/departments',
        }),
    }),
});

export const {
    useGetCoursesQuery,
    useGetCourseQuery,
    useCreateCourseMutation,
    useUpdateCourseMutation,
    useDeleteCourseMutation,
    useGetDepartmentsQuery,
} = courseApi;
