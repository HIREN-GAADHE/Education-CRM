import { apiSlice } from './apiSlice';

// Types
export interface StudentInfo {
    id: string;
    admission_number: string;
    first_name: string;
    last_name: string;
    course?: string;
    class_details?: string;
}

export interface FeePayment {
    id: string;
    tenant_id?: string;
    transaction_id?: string;
    receipt_number?: string;
    student_id: string;
    fee_type: string;
    description?: string;
    academic_year?: string;
    semester?: number;
    total_amount: number;
    paid_amount: number;
    discount_amount: number;
    fine_amount: number;
    payment_method?: string;
    payment_reference?: string;
    payment_date?: string;
    due_date?: string;
    status: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    student?: StudentInfo;
}

export interface FeePaymentListResponse {
    items: FeePayment[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface FeePaymentCreateRequest {
    student_id: string;
    fee_type: string;
    description?: string;
    academic_year?: string;
    semester?: number;
    total_amount: number;
    due_date?: string;
    notes?: string;
}

export interface FeePaymentUpdateRequest {
    status?: string;
    paid_amount?: number;
    discount_amount?: number;
    fine_amount?: number;
    notes?: string;
}

export interface MakePaymentRequest {
    payment_id: string;
    amount: number;
    payment_method: string;
    payment_reference?: string;
    notes?: string;
}

export interface FeeSummary {
    total_fees: number;
    total_paid: number;
    total_pending: number;
    total_overdue: number;
    total_discounts: number;
    payment_count: number;
}

export interface FeeComponent {
    name: string;
    type: string;
    amount: number;
    optional: boolean;
}

export interface FeeStructure {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    course?: string;
    department?: string;
    batch?: string;
    academic_year?: string;
    fee_components: FeeComponent[];
    total_amount: number;
    is_active: boolean;
}

export interface FeeStructureCreate {
    name: string;
    description?: string;
    course?: string;
    department?: string;
    batch?: string;
    academic_year?: string;
    fee_components?: FeeComponent[];
    total_amount: number;
    is_active?: boolean;
}

// Inject endpoints into the centralized apiSlice
export const feeApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getFeePayments: builder.query<FeePaymentListResponse, {
            page: number;
            pageSize: number;
            student_id?: string;
            class_id?: string;
            academic_year?: string;
            status?: string;
            fee_type?: string;
        }>({
            query: (params) => ({
                url: '/fees',
                params: {
                    page: params.page,
                    page_size: params.pageSize,
                    student_id: params.student_id,
                    class_id: params.class_id,
                    academic_year: params.academic_year,
                    status: params.status,
                    fee_type: params.fee_type,
                },
            }),
            providesTags: ['Fees'],
        }),
        getFeePayment: builder.query<FeePayment, string>({
            query: (id) => `/fees/${id}`,
            providesTags: ['Student'],
        }),
        getFeeSummary: builder.query<FeeSummary, { studentId?: string; academicYear?: string }>({
            query: ({ studentId, academicYear }) => {
                const params = new URLSearchParams();
                if (studentId) params.append('student_id', studentId);
                if (academicYear) params.append('academic_year', academicYear);
                return `/fees/summary?${params.toString()}`;
            },
            providesTags: ['Student'],
        }),
        createFeePayment: builder.mutation<FeePayment, FeePaymentCreateRequest>({
            query: (body) => ({
                url: '/fees',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Fees', 'Student'],
        }),
        updateFeePayment: builder.mutation<FeePayment, { id: string; data: FeePaymentUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/fees/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Fees', 'Student'],
        }),
        makePayment: builder.mutation<FeePayment, MakePaymentRequest>({
            query: ({ payment_id, ...body }) => ({
                url: `/fees/${payment_id}/pay`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Fees', 'Student'],
        }),
        deleteFeePayment: builder.mutation<void, string>({
            query: (id) => ({
                url: `/fees/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Fees', 'Student'],
        }),
        bulkCreateFees: builder.mutation<{ message: string; count: number }, { class_id: string; fee_type: string; amount: number; description?: string; academic_year?: string; due_date?: string; notes?: string }>({
            query: (body) => ({
                url: '/fees/bulk',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Fees', 'Student'],
        }),
        // Fee Structure endpoints
        getFeeStructures: builder.query<FeeStructure[], { active_only?: boolean }>({
            query: (params) => ({
                url: '/fee-structures',
                params: { active_only: params?.active_only ?? true },
            }),
            providesTags: ['FeeStructures'],
        }),
        createFeeStructure: builder.mutation<FeeStructure, FeeStructureCreate>({
            query: (body) => ({
                url: '/fee-structures',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['FeeStructures'],
        }),
        updateFeeStructure: builder.mutation<FeeStructure, { id: string; data: Partial<FeeStructureCreate> }>({
            query: ({ id, data }) => ({
                url: `/fee-structures/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['FeeStructures'],
        }),
        deleteFeeStructure: builder.mutation<void, string>({
            query: (id) => ({
                url: `/fee-structures/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['FeeStructures'],
        }),
    }),
});

export const {
    useGetFeePaymentsQuery,
    useGetFeePaymentQuery,
    useGetFeeSummaryQuery,
    useCreateFeePaymentMutation,
    useUpdateFeePaymentMutation,
    useMakePaymentMutation,
    useDeleteFeePaymentMutation,
    useBulkCreateFeesMutation,
    useGetFeeStructuresQuery,
    useCreateFeeStructureMutation,
    useUpdateFeeStructureMutation,
    useDeleteFeeStructureMutation,
} = feeApi;

