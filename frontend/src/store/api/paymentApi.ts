import { apiSlice } from './apiSlice';

// Types
export interface PaymentGatewayConfig {
    id: string;
    gateway: 'razorpay' | 'stripe' | 'paytm' | 'phonepe' | 'offline';
    display_name?: string;
    is_test_mode: boolean;
    is_active: boolean;
    is_default: boolean;
    supported_methods: string[];
    convenience_fee_percent: number;
    convenience_fee_fixed: number;
    pass_fee_to_customer: boolean;
    created_at: string;
}

export interface PaymentOrder {
    id: string;
    order_number: string;
    gateway: string;
    gateway_order_id?: string;
    amount: number;
    currency: string;
    convenience_fee: number;
    total_amount: number;
    purpose: string;
    description?: string;
    student_id?: string;
    payer_name?: string;
    payer_email?: string;
    status: 'created' | 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled' | 'expired';
    expires_at?: string;
    created_at: string;
    gateway_data?: Record<string, any>;
    receipt_url?: string;
}

export interface PaymentOrderListResponse {
    items: PaymentOrder[];
    total: number;
    page: number;
    page_size: number;
}

export interface CreatePaymentOrderRequest {
    amount: number;
    currency?: string;
    purpose?: string;
    description?: string;
    fee_payment_id?: string;
    student_id?: string;
    payer_name?: string;
    payer_email?: string;
    payer_phone?: string;
    gateway?: string;
    notes?: Record<string, any>;
}

export interface VerifyPaymentRequest {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    order_id?: string;
    payment_id?: string;
    signature?: string;
}

export interface VerifyPaymentResponse {
    success: boolean;
    order_number: string;
    transaction_id?: string;
    status: string;
    message: string;
    receipt_url?: string;
}

export interface PaymentTransaction {
    id: string;
    order_id: string;
    transaction_id: string;
    gateway_transaction_id?: string;
    amount: number;
    currency: string;
    payment_method?: string;
    status: string;
    error_message?: string;
    authorized_at?: string;
    captured_at?: string;
    created_at: string;
}

export interface CreateRefundRequest {
    transaction_id: string;
    amount?: number;
    reason?: string;
    notes?: Record<string, any>;
}

export interface PaymentRefund {
    id: string;
    refund_id: string;
    gateway_refund_id?: string;
    transaction_id: string;
    amount: number;
    reason?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed_at?: string;
    created_at: string;
}

export interface PaymentStats {
    total_collected: number;
    total_pending: number;
    total_refunded: number;
    total_transactions: number;
    successful_transactions: number;
    failed_transactions: number;
    success_rate: number;
    by_method: Record<string, number>;
    by_status: Record<string, number>;
}

// Inject endpoints into the centralized apiSlice
export const paymentApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Gateway Configuration
        getGatewayConfigs: builder.query<PaymentGatewayConfig[], void>({
            query: () => '/payments/gateways',
            providesTags: ['Settings'],
        }),
        createGatewayConfig: builder.mutation<PaymentGatewayConfig, Partial<PaymentGatewayConfig> & { api_key: string; api_secret: string }>({
            query: (body) => ({
                url: '/payments/gateways',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Settings'],
        }),
        deleteGatewayConfig: builder.mutation<void, string>({
            query: (gateway) => ({
                url: `/payments/gateways/${gateway}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Settings'],
        }),

        // Payment Orders
        getPaymentOrders: builder.query<PaymentOrderListResponse, { page?: number; pageSize?: number; status?: string; studentId?: string }>({
            query: ({ page = 1, pageSize = 10, status, studentId }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (status) params.append('status', status);
                if (studentId) params.append('student_id', studentId);
                return `/payments/orders?${params.toString()}`;
            },
            providesTags: ['Student'],
        }),
        getPaymentOrder: builder.query<PaymentOrder, string>({
            query: (orderId) => `/payments/orders/${orderId}`,
            providesTags: ['Student'],
        }),
        createPaymentOrder: builder.mutation<PaymentOrder, CreatePaymentOrderRequest>({
            query: (body) => ({
                url: '/payments/orders',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Student'],
        }),

        // Payment Verification
        verifyPayment: builder.mutation<VerifyPaymentResponse, VerifyPaymentRequest>({
            query: (body) => ({
                url: '/payments/verify',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Student'],
        }),

        // Transactions
        getOrderTransactions: builder.query<PaymentTransaction[], string>({
            query: (orderId) => `/payments/orders/${orderId}/transactions`,
            providesTags: ['Student'],
        }),

        // Refunds
        createRefund: builder.mutation<PaymentRefund, CreateRefundRequest>({
            query: (body) => ({
                url: '/payments/refunds',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Student'],
        }),

        // Statistics
        getPaymentStats: builder.query<PaymentStats, { fromDate?: string; toDate?: string }>({
            query: ({ fromDate, toDate }) => {
                const params = new URLSearchParams();
                if (fromDate) params.append('from_date', fromDate);
                if (toDate) params.append('to_date', toDate);
                return `/payments/stats?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),

        // Checkout
        getCheckoutData: builder.query<{ order_number: string; amount: number; currency: string; status: string; checkout_options?: Record<string, any> }, string>({
            query: (orderNumber) => `/payments/checkout/${orderNumber}`,
        }),
    }),
});

export const {
    useGetGatewayConfigsQuery,
    useCreateGatewayConfigMutation,
    useDeleteGatewayConfigMutation,
    useGetPaymentOrdersQuery,
    useGetPaymentOrderQuery,
    useCreatePaymentOrderMutation,
    useVerifyPaymentMutation,
    useGetOrderTransactionsQuery,
    useCreateRefundMutation,
    useGetPaymentStatsQuery,
    useGetCheckoutDataQuery,
} = paymentApi;
