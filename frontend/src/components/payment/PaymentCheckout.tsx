import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    TextField,
    Grid,
    CircularProgress,
    Alert,
    Divider,
    Chip,
} from '@mui/material';
import {
    Payment as PaymentIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
} from '@mui/icons-material';
import {
    useCreatePaymentOrderMutation,
    useVerifyPaymentMutation,
} from '../../store/api/paymentApi';

// Declare Razorpay type for TypeScript
declare global {
    interface Window {
        Razorpay: any;
    }
}

interface PaymentCheckoutProps {
    open: boolean;
    onClose: () => void;
    amount: number;
    purpose?: string;
    description?: string;
    studentId?: string;
    feePaymentId?: string;
    payerName?: string;
    payerEmail?: string;
    payerPhone?: string;
    onSuccess?: (orderNumber: string, transactionId: string) => void;
    onFailure?: (error: string) => void;
}

type PaymentStatus = 'idle' | 'creating' | 'processing' | 'success' | 'failed';

const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
    open,
    onClose,
    amount,
    purpose = 'fee_payment',
    description,
    studentId,
    feePaymentId,
    payerName: initialPayerName = '',
    payerEmail: initialPayerEmail = '',
    payerPhone: initialPayerPhone = '',
    onSuccess,
    onFailure,
}) => {
    const [payerName, setPayerName] = useState(initialPayerName);
    const [payerEmail, setPayerEmail] = useState(initialPayerEmail);
    const [payerPhone, setPayerPhone] = useState(initialPayerPhone);
    const [status, setStatus] = useState<PaymentStatus>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [successData, setSuccessData] = useState<{ orderNumber: string; transactionId: string } | null>(null);

    const [createOrder, { isLoading: isCreatingOrder }] = useCreatePaymentOrderMutation();
    const [verifyPayment, { isLoading: isVerifying }] = useVerifyPaymentMutation();

    // Load Razorpay script
    useEffect(() => {
        const loadRazorpayScript = () => {
            if (document.getElementById('razorpay-script')) return;

            const script = document.createElement('script');
            script.id = 'razorpay-script';
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
        };

        loadRazorpayScript();
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    };

    const handlePayment = async () => {
        if (!payerName || !payerEmail || !payerPhone) {
            setErrorMessage('Please fill in all required fields');
            return;
        }

        if (!/^\d{10}$/.test(payerPhone)) {
            setErrorMessage('Please enter a valid 10-digit phone number');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
            setErrorMessage('Please enter a valid email address');
            return;
        }

        setErrorMessage('');
        setStatus('creating');

        try {
            // Step 1: Create order on backend
            const orderResponse = await createOrder({
                amount,
                currency: 'INR',
                purpose,
                description: description || `Payment of ${formatCurrency(amount)}`,
                fee_payment_id: feePaymentId,
                student_id: studentId,
                payer_name: payerName,
                payer_email: payerEmail,
                payer_phone: payerPhone,
            }).unwrap();

            // Step 2: Open Razorpay checkout
            setStatus('processing');

            const options = {
                key: orderResponse.gateway_data?.key_id || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || '',
                amount: orderResponse.total_amount * 100, // Amount in paise
                currency: orderResponse.currency || 'INR',
                name: 'EduERP School',
                description: description || `Fee Payment - ${orderResponse.order_number}`,
                order_id: orderResponse.gateway_order_id,
                prefill: {
                    name: payerName,
                    email: payerEmail,
                    contact: payerPhone,
                },
                theme: {
                    color: '#1976d2',
                },
                handler: async (response: any) => {
                    // Step 3: Verify payment on backend
                    try {
                        const verifyResponse = await verifyPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        }).unwrap();

                        if (verifyResponse.success) {
                            setStatus('success');
                            setSuccessData({
                                orderNumber: verifyResponse.order_number,
                                transactionId: verifyResponse.transaction_id || '',
                            });
                            onSuccess?.(verifyResponse.order_number, verifyResponse.transaction_id || '');
                        } else {
                            setStatus('failed');
                            setErrorMessage(verifyResponse.message || 'Payment verification failed');
                            onFailure?.(verifyResponse.message || 'Payment verification failed');
                        }
                    } catch (verifyError: any) {
                        setStatus('failed');
                        const errMsg = verifyError?.data?.detail || 'Payment verification failed';
                        setErrorMessage(errMsg);
                        onFailure?.(errMsg);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setStatus('idle');
                        setErrorMessage('Payment was cancelled');
                    },
                },
            };

            if (window.Razorpay) {
                const razorpay = new window.Razorpay(options);
                razorpay.open();
            } else {
                throw new Error('Razorpay SDK not loaded');
            }
        } catch (error: any) {
            setStatus('failed');
            const errMsg = error?.data?.detail || error?.message || 'Failed to create payment order';
            setErrorMessage(errMsg);
            onFailure?.(errMsg);
        }
    };

    const handleClose = () => {
        if (status === 'processing') return; // Don't allow closing during payment
        setStatus('idle');
        setErrorMessage('');
        setSuccessData(null);
        onClose();
    };

    const renderContent = () => {
        if (status === 'success' && successData) {
            return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <SuccessIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom color="success.main">
                        Payment Successful!
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        Your payment has been processed successfully.
                    </Typography>
                    <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 2, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">Order Number</Typography>
                        <Typography variant="h6" fontFamily="monospace">{successData.orderNumber}</Typography>
                    </Box>
                    {successData.transactionId && (
                        <Typography variant="caption" color="text.secondary">
                            Transaction ID: {successData.transactionId}
                        </Typography>
                    )}
                </Box>
            );
        }

        if (status === 'failed') {
            return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <ErrorIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom color="error.main">
                        Payment Failed
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        {errorMessage || 'Something went wrong with your payment.'}
                    </Typography>
                    <Button variant="contained" onClick={() => setStatus('idle')}>
                        Try Again
                    </Button>
                </Box>
            );
        }

        return (
            <>
                {errorMessage && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errorMessage}
                    </Alert>
                )}

                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 3, borderRadius: 2, mb: 3, textAlign: 'center' }}>
                    <Typography variant="h3" fontWeight="bold">
                        {formatCurrency(amount)}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        {description || 'Fee Payment'}
                    </Typography>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Full Name"
                            value={payerName}
                            onChange={(e) => setPayerName(e.target.value)}
                            required
                            disabled={status !== 'idle'}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Email Address"
                            type="email"
                            value={payerEmail}
                            onChange={(e) => setPayerEmail(e.target.value)}
                            required
                            disabled={status !== 'idle'}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Phone Number"
                            value={payerPhone}
                            onChange={(e) => setPayerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            required
                            disabled={status !== 'idle'}
                            placeholder="10-digit phone number"
                        />
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Amount</Typography>
                    <Typography variant="body1" fontWeight="bold">{formatCurrency(amount)}</Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Payment Gateway</Typography>
                    <Chip label="Razorpay" color="primary" size="small" />
                </Box>

                <Alert severity="info" sx={{ mt: 2 }}>
                    Secure payment powered by Razorpay. Your card details are encrypted and secure.
                </Alert>
            </>
        );
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentIcon color="primary" />
                {status === 'success' ? 'Payment Complete' : 'Complete Payment'}
            </DialogTitle>
            <DialogContent>
                {renderContent()}
            </DialogContent>
            <DialogActions>
                {status === 'success' ? (
                    <Button variant="contained" onClick={handleClose}>
                        Done
                    </Button>
                ) : status === 'failed' ? (
                    <Button onClick={handleClose}>Close</Button>
                ) : (
                    <>
                        <Button onClick={handleClose} disabled={status !== 'idle'}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handlePayment}
                            disabled={status !== 'idle' || isCreatingOrder || isVerifying}
                            startIcon={
                                (status === 'creating' || status === 'processing') ? (
                                    <CircularProgress size={20} color="inherit" />
                                ) : (
                                    <PaymentIcon />
                                )
                            }
                        >
                            {status === 'creating' ? 'Creating Order...' :
                                status === 'processing' ? 'Processing...' :
                                    `Pay ${formatCurrency(amount)}`}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default PaymentCheckout;
