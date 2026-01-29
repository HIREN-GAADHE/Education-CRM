import { apiSlice } from './apiSlice';

// Types
export interface StudentInfo {
    id: string;
    admission_number: string;
    first_name: string;
    last_name: string;
    course?: string;
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

// Inject endpoints into the centralized apiSlice
export const feeApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getFeePayments: builder.query<FeePaymentListResponse, { page?: number; pageSize?: number; studentId?: string; status?: string; feeType?: string }>({
            query: ({ page = 1, pageSize = 10, studentId, status, feeType }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (studentId) params.append('student_id', studentId);
                if (status) params.append('status', status);
                if (feeType) params.append('fee_type', feeType);
                return `/fees?${params.toString()}`;
            },
            providesTags: ['Student'],
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
            invalidatesTags: ['Student'],
        }),
        updateFeePayment: builder.mutation<FeePayment, { id: string; data: FeePaymentUpdateRequest }>({
            query: ({ id, data }) => ({
                url: `/fees/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Student'],
        }),
        makePayment: builder.mutation<FeePayment, MakePaymentRequest>({
            query: ({ payment_id, ...body }) => ({
                url: `/fees/${payment_id}/pay`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Student'],
        }),
        deleteFeePayment: builder.mutation<void, string>({
            query: (id) => ({
                url: `/fees/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Student'],
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
} = feeApi;
