import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Chip, IconButton,
    TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, FormControl, InputLabel, Select, MenuItem,
    Pagination, Avatar, ButtonGroup
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Payment as PaymentIcon,
    Check as CheckIcon,
    Person as PersonIcon,
    CreditCard as CreditCardIcon,
} from '@mui/icons-material';
import {
    useGetFeePaymentsQuery,
    useGetFeeSummaryQuery,
    useCreateFeePaymentMutation,
    useMakePaymentMutation,
    useUpdateFeePaymentMutation,
    useDeleteFeePaymentMutation,
} from '@/store/api/feeApi';
import type { FeePayment } from '@/store/api/feeApi';
import { useGetStudentsQuery } from '@/store/api/studentApi';
import { toast } from 'react-toastify';
import { PaymentCheckout } from '@/components/payment';

const FeesPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
    const [openStatusDialog, setOpenStatusDialog] = useState(false);
    const [openOnlinePayment, setOpenOnlinePayment] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Create form state
    const [createForm, setCreateForm] = useState({
        student_id: '',
        fee_type: 'tuition',
        total_amount: 0,
        academic_year: '2024-25',
        due_date: '',
        description: '',
    });

    // Payment form state
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        payment_method: 'cash',
        payment_reference: '',
        notes: '',
    });

    // Status change state
    const [newStatus, setNewStatus] = useState('');

    // API hooks
    const { data: fees, isLoading, error, refetch } = useGetFeePaymentsQuery({ page, pageSize: 10 });
    const { data: summary, refetch: refetchSummary } = useGetFeeSummaryQuery({});
    const { data: students } = useGetStudentsQuery({ page: 1, pageSize: 100 });
    const [createFeePayment, { isLoading: isCreating }] = useCreateFeePaymentMutation();
    const [makePayment, { isLoading: isPaying }] = useMakePaymentMutation();
    const [updateFeePayment, { isLoading: isUpdating }] = useUpdateFeePaymentMutation();
    const [deleteFeePayment, { isLoading: isDeleting }] = useDeleteFeePaymentMutation();

    const feeTypes = [
        { value: 'tuition', label: 'Tuition Fee' },
        { value: 'admission', label: 'Admission Fee' },
        { value: 'examination', label: 'Examination Fee' },
        { value: 'laboratory', label: 'Laboratory Fee' },
        { value: 'transport', label: 'Transport Fee' },
        { value: 'sports', label: 'Sports Fee' },
        { value: 'other', label: 'Other' },
    ];

    const paymentMethods = [
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
        { value: 'upi', label: 'UPI' },
        { value: 'net_banking', label: 'Net Banking' },
        { value: 'cheque', label: 'Cheque' },
    ];

    const statusOptions = [
        { value: 'pending', label: 'Pending', color: 'warning' },
        { value: 'partial', label: 'Partial', color: 'info' },
        { value: 'completed', label: 'Completed', color: 'success' },
        { value: 'overdue', label: 'Overdue', color: 'error' },
        { value: 'cancelled', label: 'Cancelled', color: 'default' },
    ];

    const handleOpenCreate = () => {
        setCreateForm({
            student_id: '',
            fee_type: 'tuition',
            total_amount: 0,
            academic_year: '2024-25',
            due_date: '',
            description: '',
        });
        setOpenCreateDialog(true);
    };

    const handleCreate = async () => {
        try {
            await createFeePayment(createForm).unwrap();
            toast.success('Fee record created!');
            setOpenCreateDialog(false);
            refetch();
            refetchSummary();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to create fee');
        }
    };

    const handleOpenPayment = (payment: FeePayment) => {
        setSelectedPayment(payment);
        const balance = payment.total_amount - payment.paid_amount - payment.discount_amount + payment.fine_amount;
        setPaymentForm({
            amount: balance > 0 ? balance : 0,
            payment_method: 'cash',
            payment_reference: '',
            notes: '',
        });
        setOpenPaymentDialog(true);
    };

    const handleOpenOnlinePayment = (payment: FeePayment) => {
        setSelectedPayment(payment);
        setOpenOnlinePayment(true);
    };

    const handleOnlinePaymentSuccess = (orderNumber: string, transactionId: string) => {
        toast.success(`Payment successful! Order: ${orderNumber}`);
        setOpenOnlinePayment(false);
        setSelectedPayment(null);
        refetch();
        refetchSummary();
    };

    const handleOnlinePaymentFailure = (error: string) => {
        toast.error(`Payment failed: ${error}`);
    };

    const handleConfirmPayment = async () => {
        if (!selectedPayment) return;
        try {
            await makePayment({
                payment_id: selectedPayment.id,
                amount: paymentForm.amount,
                payment_method: paymentForm.payment_method,
                payment_reference: paymentForm.payment_reference || undefined,
                notes: paymentForm.notes || undefined,
            }).unwrap();
            toast.success('Payment recorded successfully!');
            setOpenPaymentDialog(false);
            setSelectedPayment(null);
            refetch();
            refetchSummary();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Payment failed');
        }
    };

    const handleOpenStatusChange = (payment: FeePayment) => {
        setSelectedPayment(payment);
        setNewStatus(payment.status);
        setOpenStatusDialog(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!selectedPayment) return;
        try {
            await updateFeePayment({
                id: selectedPayment.id,
                data: { status: newStatus },
            }).unwrap();
            toast.success('Status updated!');
            setOpenStatusDialog(false);
            setSelectedPayment(null);
            refetch();
            refetchSummary();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to update status');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteFeePayment(id).unwrap();
            toast.success('Fee record deleted!');
            setDeleteConfirm(null);
            refetch();
            refetchSummary();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const getStatusColor = (status: string) => {
        return statusOptions.find(s => s.value === status)?.color || 'default';
    };

    const getStudentName = (fee: FeePayment) => {
        if (fee.student) {
            return `${fee.student.first_name} ${fee.student.last_name}`;
        }
        return 'Unknown Student';
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Fees & Finance
                    </Typography>
                    <Typography color="text.secondary">
                        Manage fee payments and financial records
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 3 }}>
                    Add Fee
                </Button>
            </Box>

            {/* Summary Cards */}
            {summary && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                            <CardContent>
                                <Typography variant="h4" fontWeight="bold">₹{summary.total_fees.toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Fees</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                            <CardContent>
                                <Typography variant="h4" fontWeight="bold">₹{summary.total_paid.toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>Collected</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white' }}>
                            <CardContent>
                                <Typography variant="h4" fontWeight="bold">₹{summary.total_pending.toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>Pending</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white' }}>
                            <CardContent>
                                <Typography variant="h4" fontWeight="bold">₹{summary.total_overdue.toLocaleString()}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>Overdue</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load fees.</Alert>}

            {/* Fees Table */}
            {!isLoading && fees && (
                <Card sx={{ overflow: 'hidden' }}>
                    <TableContainer sx={{ maxHeight: 600, overflowX: 'auto' }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ minWidth: 180, fontWeight: 'bold', bgcolor: 'grey.100' }}>Student</TableCell>
                                    <TableCell sx={{ minWidth: 100, fontWeight: 'bold', bgcolor: 'grey.100' }}>Fee Type</TableCell>
                                    <TableCell align="right" sx={{ minWidth: 90, fontWeight: 'bold', bgcolor: 'grey.100' }}>Total (₹)</TableCell>
                                    <TableCell align="right" sx={{ minWidth: 90, fontWeight: 'bold', bgcolor: 'grey.100' }}>Paid (₹)</TableCell>
                                    <TableCell align="right" sx={{ minWidth: 90, fontWeight: 'bold', bgcolor: 'grey.100' }}>Balance (₹)</TableCell>
                                    <TableCell sx={{ minWidth: 80, fontWeight: 'bold', bgcolor: 'grey.100' }}>Status</TableCell>
                                    <TableCell sx={{ minWidth: 80, fontWeight: 'bold', bgcolor: 'grey.100' }}>Receipt</TableCell>
                                    <TableCell align="center" sx={{ minWidth: 150, fontWeight: 'bold', bgcolor: 'grey.100' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {fees.items.map((fee) => {
                                    const balance = fee.total_amount - fee.paid_amount - fee.discount_amount + fee.fine_amount;
                                    return (
                                        <TableRow key={fee.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                                                        {fee.student ? `${fee.student.first_name[0]}${fee.student.last_name[0]}` : <PersonIcon fontSize="small" />}
                                                    </Avatar>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight={600} noWrap>
                                                            {getStudentName(fee)}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" noWrap>
                                                            {fee.student?.admission_number || '-'} • {fee.academic_year}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ textTransform: 'capitalize' }}>{fee.fee_type.replace('_', ' ')}</TableCell>
                                            <TableCell align="right">{fee.total_amount.toLocaleString()}</TableCell>
                                            <TableCell align="right" sx={{ color: fee.paid_amount > 0 ? 'success.main' : 'inherit', fontWeight: fee.paid_amount > 0 ? 600 : 400 }}>
                                                {fee.paid_amount.toLocaleString()}
                                                {fee.paid_amount > 0 && ' ✓'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: balance > 0 ? 'error.main' : 'success.main' }}>
                                                {balance.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={fee.status.replace('_', ' ')}
                                                    size="small"
                                                    color={getStatusColor(fee.status) as any}
                                                    onClick={() => handleOpenStatusChange(fee)}
                                                    sx={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.7rem' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {fee.receipt_number ? (
                                                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                                                        {fee.receipt_number}
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                                                    {fee.status !== 'completed' && fee.status !== 'cancelled' && (
                                                        <>
                                                            <IconButton
                                                                size="small"
                                                                color="primary"
                                                                onClick={() => handleOpenOnlinePayment(fee)}
                                                                title="Pay Online"
                                                                sx={{ bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}
                                                            >
                                                                <CreditCardIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                color="success"
                                                                onClick={() => handleOpenPayment(fee)}
                                                                title="Cash/Manual Payment"
                                                                sx={{ bgcolor: 'success.light', color: 'white', '&:hover': { bgcolor: 'success.main' } }}
                                                            >
                                                                <PaymentIcon fontSize="small" />
                                                            </IconButton>
                                                        </>
                                                    )}
                                                    {fee.status === 'completed' && (
                                                        <Chip label="PAID" color="success" size="small" sx={{ fontSize: '0.65rem' }} />
                                                    )}
                                                    <IconButton size="small" onClick={() => handleOpenStatusChange(fee)} title="Edit Status">
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(fee.id)} title="Delete">
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            )}

            {/* Empty State */}
            {!isLoading && fees?.items.length === 0 && (
                <Card sx={{ p: 6, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>No fee records found</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>Add Fee</Button>
                </Card>
            )}

            {/* Pagination */}
            {fees && fees.total_pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Pagination count={fees.total_pages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                </Box>
            )}

            {/* Create Fee Dialog */}
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Add New Fee
                    <IconButton onClick={() => setOpenCreateDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Student *</InputLabel>
                            <Select value={createForm.student_id} label="Student *" onChange={(e) => setCreateForm({ ...createForm, student_id: e.target.value })}>
                                {students?.items.map(s => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Fee Type</InputLabel>
                            <Select value={createForm.fee_type} label="Fee Type" onChange={(e) => setCreateForm({ ...createForm, fee_type: e.target.value })}>
                                {feeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="Total Amount (₹) *"
                            type="number"
                            value={createForm.total_amount}
                            onChange={(e) => setCreateForm({ ...createForm, total_amount: Number(e.target.value) })}
                        />
                        <TextField
                            fullWidth
                            label="Academic Year"
                            value={createForm.academic_year}
                            onChange={(e) => setCreateForm({ ...createForm, academic_year: e.target.value })}
                        />
                        <TextField
                            fullWidth
                            label="Due Date"
                            type="date"
                            value={createForm.due_date}
                            onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            fullWidth
                            label="Description"
                            value={createForm.description}
                            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreate} disabled={isCreating || !createForm.student_id || !createForm.total_amount}>
                        {isCreating ? <CircularProgress size={24} /> : 'Create Fee'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Payment Confirmation Dialog */}
            <Dialog open={openPaymentDialog} onClose={() => setOpenPaymentDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Confirm Payment
                    <IconButton onClick={() => setOpenPaymentDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedPayment && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                <strong>Student:</strong> {getStudentName(selectedPayment)}<br />
                                <strong>Fee Type:</strong> {selectedPayment.fee_type}<br />
                                <strong>Balance:</strong> ₹{(selectedPayment.total_amount - selectedPayment.paid_amount - selectedPayment.discount_amount + selectedPayment.fine_amount).toLocaleString()}
                            </Alert>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Payment Amount (₹) *"
                                    type="number"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                                />
                                <FormControl fullWidth>
                                    <InputLabel>Payment Method</InputLabel>
                                    <Select value={paymentForm.payment_method} label="Payment Method" onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
                                        {paymentMethods.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <TextField
                                    fullWidth
                                    label="Reference Number"
                                    value={paymentForm.payment_reference}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                                    placeholder="Transaction ID, Cheque No., etc."
                                />
                                <TextField
                                    fullWidth
                                    label="Notes"
                                    multiline
                                    rows={2}
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                />
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenPaymentDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<CheckIcon />}
                        onClick={handleConfirmPayment}
                        disabled={isPaying || paymentForm.amount <= 0}
                    >
                        {isPaying ? <CircularProgress size={24} /> : 'Confirm Payment'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Status Change Dialog */}
            <Dialog open={openStatusDialog} onClose={() => setOpenStatusDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    Change Status
                    <IconButton onClick={() => setOpenStatusDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedPayment && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <strong>Student:</strong> {getStudentName(selectedPayment)}<br />
                            <strong>Fee:</strong> {selectedPayment.fee_type} - ₹{selectedPayment.total_amount.toLocaleString()}
                        </Alert>
                    )}
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel>Status</InputLabel>
                        <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
                            {statusOptions.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenStatusDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleConfirmStatusChange} disabled={isUpdating}>
                        {isUpdating ? <CircularProgress size={24} /> : 'Update Status'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent><Typography>Are you sure you want to delete this fee record?</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={isDeleting}>
                        {isDeleting ? <CircularProgress size={24} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Online Payment Checkout */}
            {selectedPayment && (
                <PaymentCheckout
                    open={openOnlinePayment}
                    onClose={() => {
                        setOpenOnlinePayment(false);
                        setSelectedPayment(null);
                    }}
                    amount={selectedPayment.total_amount - selectedPayment.paid_amount - selectedPayment.discount_amount + selectedPayment.fine_amount}
                    purpose="fee_payment"
                    description={`${selectedPayment.fee_type.replace('_', ' ')} - ${selectedPayment.academic_year}`}
                    studentId={selectedPayment.student_id}
                    feePaymentId={selectedPayment.id}
                    payerName={selectedPayment.student ? `${selectedPayment.student.first_name} ${selectedPayment.student.last_name}` : ''}
                    onSuccess={handleOnlinePaymentSuccess}
                    onFailure={handleOnlinePaymentFailure}
                />
            )}
        </Box>
    );
};

export default FeesPage;
