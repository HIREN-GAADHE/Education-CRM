import { apiSlice } from './apiSlice';
import { SchoolClass } from '../../types';

export interface Staff {
    id: string;
    tenant_id?: string;
    employee_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    staff_type?: string;
    designation?: string;
    department?: string;
    qualification?: string;
    experience_years?: number;
    joining_date?: string;
    basic_salary?: number;
    status: string;
    avatar_url?: string;
    associated_classes?: SchoolClass[];
    created_at: string;
    updated_at: string;
}

export interface StaffListResponse {
    items: Staff[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface StaffCreateRequest {
    employee_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    staff_type?: string;
    designation?: string;
    department?: string;
    qualification?: string;
    experience_years?: number;
    joining_date?: string;
    basic_salary?: number;
    status?: string;
    class_ids?: string[];
}

export interface StaffUpdateRequest {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    staff_type?: string;
    designation?: string;
    department?: string;
    qualification?: string;
    experience_years?: number;
    basic_salary?: number;
    status?: string;
    class_ids?: string[];
}

// Inject endpoints into the centralized apiSlice
export const staffApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getStaff: builder.query<StaffListResponse, { page?: number; pageSize?: number; page_size?: number; search?: string; staffType?: string; staff_type?: string; department?: string; class_id?: string }>({
            query: ({ page = 1, pageSize, page_size, search, staffType, staff_type, department, class_id }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', (pageSize || page_size || 10).toString());
                if (search) params.append('search', search);
                if (staffType || staff_type) params.append('staff_type', staffType || staff_type || '');
                if (department) params.append('department', department);
                if (class_id) params.append('class_id', class_id);
                return `/staff?${params.toString()}`;
            },
            providesTags: ['Staff'],
        }),
        getStaffById: builder.query<Staff, string>({
            query: (id) => `/staff/${id}`,
            providesTags: ['Staff'],
        }),
        createStaff: builder.mutation<Staff, StaffCreateRequest>({
            query: (data) => ({
                url: '/staff',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Staff'],
        }),
        updateStaff: builder.mutation<Staff, { id: string; data: StaffUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/staff/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Staff'],
        }),
        deleteStaff: builder.mutation<void, string>({
            query: (id) => ({
                url: `/staff/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Staff'],
        }),
    }),
});

export const {
    useGetStaffQuery,
    useGetStaffByIdQuery,
    useCreateStaffMutation,
    useUpdateStaffMutation,
    useDeleteStaffMutation,
} = staffApi;
