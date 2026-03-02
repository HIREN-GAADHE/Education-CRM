import { apiSlice } from './apiSlice';

export interface SalaryStructure {
    id: string;
    name: string;
    description?: string;
    base_salary: number;
    allowances: Record<string, { type: 'percent' | 'fixed'; value: number }>;
    deductions: Record<string, { type: 'percent' | 'fixed'; value: number }>;
    is_active: boolean;
    created_at: string;
}

export interface SalaryAssignment {
    id: string;
    staff_id: string;
    staff_name?: string;
    staff_designation?: string;
    structure_id: string;
    structure_name?: string;
    effective_from: string;
    effective_to?: string;
    custom_base_salary?: number;
    bank_account_number?: string;
    bank_name?: string;
    ifsc_code?: string;
    pan_number?: string;
    created_at: string;
}

export type PayslipStatus = 'pending' | 'paid' | 'on_hold' | 'cancelled';

export interface Payslip {
    id: string;
    staff_id: string;
    staff_name?: string;
    staff_designation?: string;
    staff_employee_id?: string;
    structure_name?: string;
    month: number;
    year: number;
    base_salary: number;
    gross_salary: number;
    total_deductions: number;
    net_salary: number;
    allowances_breakdown: Record<string, number>;
    deductions_breakdown: Record<string, number>;
    days_worked?: number;
    loss_of_pay_days: number;
    loss_of_pay_amount: number;
    bonus: number;
    advance_deduction: number;
    status: PayslipStatus;
    payment_mode?: string;
    paid_at?: string;
    remarks?: string;
    created_at: string;
}

export interface PayrollSummary {
    month: number;
    year: number;
    total_payslips: number;
    total_gross: number;
    total_net: number;
    total_deductions: number;
    paid_count: number;
    pending_count: number;
    on_hold_count: number;
}

export interface PayrollRunResult {
    month: number;
    year: number;
    generated: number;
    skipped: number;
    message: string;
}

export interface BulkPayResult {
    marked_paid: number;
    month: number;
    year: number;
}

const payrollApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Salary Structures
        getStructures: builder.query<SalaryStructure[], { is_active?: boolean }>({
            query: ({ is_active } = {}) => ({ url: '/payroll/structures', params: is_active !== undefined ? { is_active } : {} }),
            providesTags: ['Payroll'],
        }),
        createStructure: builder.mutation<SalaryStructure, Partial<SalaryStructure>>({
            query: (data) => ({ url: '/payroll/structures', method: 'POST', body: data }),
            invalidatesTags: ['Payroll'],
        }),
        updateStructure: builder.mutation<SalaryStructure, { id: string; data: Partial<SalaryStructure> }>({
            query: ({ id, data }) => ({ url: `/payroll/structures/${id}`, method: 'PUT', body: data }),
            invalidatesTags: ['Payroll'],
        }),
        deleteStructure: builder.mutation<void, string>({
            query: (id) => ({ url: `/payroll/structures/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Payroll'],
        }),

        // Assignments
        getSalaryAssignments: builder.query<SalaryAssignment[], { staff_id?: string }>({
            query: ({ staff_id } = {}) => ({ url: '/payroll/assignments', params: staff_id ? { staff_id } : {} }),
            providesTags: ['Payroll'],
        }),
        createSalaryAssignment: builder.mutation<SalaryAssignment, Partial<SalaryAssignment>>({
            query: (data) => ({ url: '/payroll/assignments', method: 'POST', body: data }),
            invalidatesTags: ['Payroll'],
        }),
        updateSalaryAssignment: builder.mutation<SalaryAssignment, { id: string; data: Partial<SalaryAssignment> }>({
            query: ({ id, data }) => ({ url: `/payroll/assignments/${id}`, method: 'PUT', body: data }),
            invalidatesTags: ['Payroll'],
        }),
        deleteSalaryAssignment: builder.mutation<void, string>({
            query: (id) => ({ url: `/payroll/assignments/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Payroll'],
        }),

        // Payroll Run
        runPayroll: builder.mutation<PayrollRunResult, { month: number; year: number; working_days?: number }>({
            query: (data) => ({ url: '/payroll/run', method: 'POST', body: data }),
            invalidatesTags: ['Payroll'],
        }),

        // Payslips
        getPayslips: builder.query<{ items: Payslip[]; total: number; total_pages: number }, { month?: number; year?: number; staff_id?: string; status?: string; page?: number }>({
            query: (params) => ({ url: '/payroll/payslips', params }),
            providesTags: ['Payroll'],
        }),
        updatePayslipStatus: builder.mutation<Payslip, { id: string; status: PayslipStatus; payment_mode?: string; remarks?: string }>({
            query: ({ id, ...data }) => ({ url: `/payroll/payslips/${id}/status`, method: 'PATCH', body: data }),
            invalidatesTags: ['Payroll'],
        }),
        updatePayslipAdjustments: builder.mutation<Payslip, { id: string; loss_of_pay_days?: number; bonus?: number; advance_deduction?: number; days_worked?: number }>({
            query: ({ id, ...data }) => ({ url: `/payroll/payslips/${id}/adjustments`, method: 'PATCH', body: data }),
            invalidatesTags: ['Payroll'],
        }),
        deletePayslip: builder.mutation<void, string>({
            query: (id) => ({ url: `/payroll/payslips/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Payroll'],
        }),

        // Bulk Pay
        bulkPayPayslips: builder.mutation<BulkPayResult, { month: number; year: number; payment_mode?: string }>({
            query: (data) => ({ url: '/payroll/payslips/bulk-pay', method: 'POST', body: data }),
            invalidatesTags: ['Payroll'],
        }),

        // Summary
        getPayrollSummary: builder.query<PayrollSummary, { month: number; year: number }>({
            query: ({ month, year }) => `/payroll/summary?month=${month}&year=${year}`,
            providesTags: ['Payroll'],
        }),
    }),
});

export const {
    useGetStructuresQuery, useCreateStructureMutation, useUpdateStructureMutation, useDeleteStructureMutation,
    useGetSalaryAssignmentsQuery, useCreateSalaryAssignmentMutation, useUpdateSalaryAssignmentMutation, useDeleteSalaryAssignmentMutation,
    useRunPayrollMutation,
    useGetPayslipsQuery, useUpdatePayslipStatusMutation, useUpdatePayslipAdjustmentsMutation, useDeletePayslipMutation,
    useBulkPayPayslipsMutation,
    useGetPayrollSummaryQuery,
} = payrollApi;
