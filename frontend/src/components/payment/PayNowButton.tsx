import React, { useState } from 'react';
import { Button } from '@mui/material';
import { Payment as PaymentIcon } from '@mui/icons-material';
import PaymentCheckout from './PaymentCheckout';

interface PayNowButtonProps {
    amount: number;
    purpose?: string;
    description?: string;
    studentId?: string;
    feePaymentId?: string;
    payerName?: string;
    payerEmail?: string;
    payerPhone?: string;
    variant?: 'text' | 'outlined' | 'contained';
    size?: 'small' | 'medium' | 'large';
    fullWidth?: boolean;
    disabled?: boolean;
    onSuccess?: (orderNumber: string, transactionId: string) => void;
    onFailure?: (error: string) => void;
}

const PayNowButton: React.FC<PayNowButtonProps> = ({
    amount,
    purpose = 'fee_payment',
    description,
    studentId,
    feePaymentId,
    payerName = '',
    payerEmail = '',
    payerPhone = '',
    variant = 'contained',
    size = 'medium',
    fullWidth = false,
    disabled = false,
    onSuccess,
    onFailure,
}) => {
    const [checkoutOpen, setCheckoutOpen] = useState(false);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    };

    const handleSuccess = (orderNumber: string, transactionId: string) => {
        onSuccess?.(orderNumber, transactionId);
    };

    const handleFailure = (error: string) => {
        onFailure?.(error);
    };

    return (
        <>
            <Button
                variant={variant}
                size={size}
                fullWidth={fullWidth}
                disabled={disabled || amount <= 0}
                onClick={() => setCheckoutOpen(true)}
                startIcon={<PaymentIcon />}
                color="primary"
            >
                Pay {formatCurrency(amount)}
            </Button>

            <PaymentCheckout
                open={checkoutOpen}
                onClose={() => setCheckoutOpen(false)}
                amount={amount}
                purpose={purpose}
                description={description}
                studentId={studentId}
                feePaymentId={feePaymentId}
                payerName={payerName}
                payerEmail={payerEmail}
                payerPhone={payerPhone}
                onSuccess={handleSuccess}
                onFailure={handleFailure}
            />
        </>
    );
};

export default PayNowButton;
