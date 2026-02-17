import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Chip, IconButton,
    TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, FormControl, InputLabel, Select, MenuItem,
    TablePagination, Avatar // Changed Pagination to TablePagination
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Payment as PaymentIcon,
    Person as PersonIcon,
    CreditCard as CreditCardIcon,
    Settings as SettingsIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import {
    useGetFeePaymentsQuery,
    useGetFeeSummaryQuery,
    useCreateFeePaymentMutation,
    useMakePaymentMutation,
    useUpdateFeePaymentMutation,
    useDeleteFeePaymentMutation,
    useBulkCreateFeesMutation,
    useGetFeeStructuresQuery,
} from '@/store/api/feeApi';
import type { FeePayment } from '@/store/api/feeApi';
import { useGetStudentsQuery } from '@/store/api/studentApi';
import { useGetClassesQuery } from '@/store/api/academicApi';
import { toast } from 'react-toastify';
import { PaymentCheckout } from '@/components/payment';
import { ReminderDialog } from '@/components/fees/ReminderDialog';
import ReminderSettingsDialog from '@/components/fees/ReminderSettingsDialog';
import FeeStructureDialog from '@/components/fees/FeeStructureDialog';
import { useSendReceiptMutation, useBulkSendRemindersMutation, useSendRemindersMutation } from '@/store/api/remindersApi';
import {
    Notifications as NotificationsIcon,
    Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';

const FeesPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10); // Added state
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
    const [openStatusDialog, setOpenStatusDialog] = useState(false);
    const [openOnlinePayment, setOpenOnlinePayment] = useState(false);
    const [openSettingsDialog, setOpenSettingsDialog] = useState(false);
    const [openStructuresDialog, setOpenStructuresDialog] = useState(false);

    // Selection & Filters
    const [selectedFees, setSelectedFees] = useState<string[]>([]);
    // Dynamic academic year based on current date (April start)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11
    // If April (3) or later, use Current-Next. If Jan-Mar, use Prev-Current.
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const defaultAcademicYear = `${startYear}-${startYear + 1}`;

    const [filters, setFilters] = useState({
        classId: '',
        status: '',
        academicYear: defaultAcademicYear
    });

    const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [openReminderDialog, setOpenReminderDialog] = useState(false);
    const [reminderTargets, setReminderTargets] = useState<{ studentIds: string[], paymentIds?: string[], studentName?: string }>({ studentIds: [] });

    // Create form state
    const [createForm, setCreateForm] = useState({
        student_id: '',
        fee_type: 'tuition',
        total_amount: 0,
        academic_year: defaultAcademicYear,
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
    const { data: fees, isLoading, error, refetch } = useGetFeePaymentsQuery({
        page,
        pageSize: rowsPerPage, // Use dynamic pageSize
        class_id: filters.classId || undefined,
        status: filters.status || undefined,
        academic_year: filters.academicYear || undefined
    });
    const { data: summary, refetch: refetchSummary } = useGetFeeSummaryQuery({});
    const { data: students } = useGetStudentsQuery({ page: 1, pageSize: 300 });
    const { data: classes } = useGetClassesQuery();
    const { data: feeStructures } = useGetFeeStructuresQuery({ active_only: true });

    const [createFeePayment, { isLoading: isCreating }] = useCreateFeePaymentMutation();
    const [makePayment, { isLoading: isPaying }] = useMakePaymentMutation();
    const [updateFeePayment, { isLoading: isUpdating }] = useUpdateFeePaymentMutation();
    const [deleteFeePayment, { isLoading: isDeleting }] = useDeleteFeePaymentMutation();
    const [bulkSendReminders, { isLoading: isBulkSending }] = useBulkSendRemindersMutation();

    // Bulk Create State
    const [openBulkCreateDialog, setOpenBulkCreateDialog] = useState(false);
    const [selectedStructureId, setSelectedStructureId] = useState('');
    const [bulkCreateForm, setBulkCreateForm] = useState({
        class_id: '',
        fee_type: 'tuition',
        amount: 0,
        academic_year: defaultAcademicYear,
        due_date: '',
        description: '',
        notes: ''
    });
    const [bulkCreateFees, { isLoading: isBulkCreating }] = useBulkCreateFeesMutation();

    const handleOpenBulkCreate = () => {
        setSelectedStructureId('');
        setBulkCreateForm({
            class_id: '',
            fee_type: 'tuition',
            amount: 0,
            academic_year: defaultAcademicYear,
            due_date: '',
            description: '',
            notes: ''
        });
        setOpenBulkCreateDialog(true);
    };

    const handleStructureSelect = (structureId: string) => {
        setSelectedStructureId(structureId);
        const selected = feeStructures?.find(s => s.id === structureId);
        if (selected) {
            setBulkCreateForm(prev => ({
                ...prev,
                fee_type: selected.fee_components?.[0]?.type || 'tuition',
                amount: selected.total_amount,
                description: selected.name + (selected.description ? ` - ${selected.description}` : ''),
                academic_year: selected.academic_year || prev.academic_year,
            }));
        } else {
            setBulkCreateForm(prev => ({
                ...prev,
                fee_type: 'tuition',
                amount: 0,
                description: '',
            }));
        }
    };

    const handleBulkCreateSubmit = async () => {
        if (!bulkCreateForm.class_id) {
            toast.error("Please select a class");
            return;
        }
        try {
            const result = await bulkCreateFees(bulkCreateForm).unwrap();
            toast.success(result.message);
            setOpenBulkCreateDialog(false);
            refetch();
            refetchSummary();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to generate bulk fees');
        }
    };

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

    const getStudentName = (fee: FeePayment) => {
        if (fee.student) {
            return `${fee.student.first_name} ${fee.student.last_name}`;
        }
        return 'Unknown Student';
    };

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked && fees?.items) {
            setSelectedFees(fees.items.map((fee) => fee.id));
        } else {
            setSelectedFees([]);
        }
    };

    const handleSelectOne = (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
        if (event.target.checked) {
            setSelectedFees((prev) => [...prev, id]);
        } else {
            setSelectedFees((prev) => prev.filter((feeId) => feeId !== id));
        }
    };


    const [sendReminders, { isLoading: isSendingReminders }] = useSendRemindersMutation();

    const handleSendSelectedReminders = async () => {
        if (selectedFees.length === 0) return;
        try {
            // We need student IDs corresponding to these payments.
            // We can find them from fees.items
            const selectedPaymentObjects = fees?.items.filter(f => selectedFees.includes(f.id));
            if (!selectedPaymentObjects) return;

            const studentIds = [...new Set(selectedPaymentObjects.map(f => f.student_id))];

            await sendReminders({
                student_ids: studentIds,
                fee_payment_ids: selectedFees,
                channels: ['email'] // Default to email for quick action
            }).unwrap();

            toast.success(`Reminders sent to ${studentIds.length} students`);
            setSelectedFees([]);
        } catch (err) {
            toast.error("Failed to send reminders");
        }
    };

    const handleSendFilteredReminders = async () => {
        if (!filters.classId && !filters.status) {
            if (!confirm("No filters selected. This will send reminders to ALL students. Are you sure?")) return;
        } else {
            if (!confirm(`Send reminders to all students matching current filters?`)) return;
        }

        try {
            await bulkSendReminders({
                filters: {
                    class_id: filters.classId || undefined,
                    status: filters.status || 'pending', // Default to pending if not specified? 
                    // Actually if status empty, backend defaults to pending/overdue
                    academic_year: filters.academicYear,
                },
                channels: ['email']
            }).unwrap();
            toast.success("Bulk reminder process started");
        } catch (err) {
            toast.error("Failed to initiate bulk reminders");
        }
    };

    const handleOpenReminder = (fee: FeePayment) => {
        setReminderTargets({
            studentIds: [fee.student_id],
            paymentIds: [fee.id],
            studentName: getStudentName(fee)
        });
        setOpenReminderDialog(true);
    };

    const [sendReceipt] = useSendReceiptMutation();
    const handleSendReceipt = async (fee: FeePayment) => {
        if (!confirm("Send receipt to student via email?")) return;
        try {
            await sendReceipt({
                payment_id: fee.id,
                channels: ['email']
            }).unwrap();
            toast.success("Receipt sent successfully");
        } catch (err) {
            toast.error("Failed to send receipt");
        }
    };

    const handleOpenCreate = () => {
        setCreateForm({
            student_id: '',
            fee_type: 'tuition',
            total_amount: 0,
            academic_year: defaultAcademicYear,
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

    const handleOpenPayment = (fee: FeePayment) => {
        setSelectedPayment(fee);
        const balance = fee.total_amount - fee.paid_amount - fee.discount_amount + fee.fine_amount;
        setPaymentForm({
            amount: balance > 0 ? balance : 0,
            payment_method: 'cash',
            payment_reference: '',
            notes: '',
        });
        setOpenPaymentDialog(true);
    };

    const handleOpenOnlinePayment = (fee: FeePayment) => {
        setSelectedPayment(fee);
        setOpenOnlinePayment(true);
    };

    const handleMakePayment = async () => {
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
            toast.error(err?.data?.detail || 'Failed to record payment');
        }
    };


    const handleStatusChange = async () => {
        if (!selectedPayment || !newStatus) return;
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
            toast.error(err?.data?.detail || 'Failed to delete fee');
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: 'primary.main' }}>
                    Fee Management
                </Typography>
                <Box>
                    <Button
                        variant="outlined"
                        onClick={() => setOpenStructuresDialog(true)}
                        sx={{ mr: 2 }}
                    >
                        Fee Structures
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleOpenBulkCreate}
                        disabled={isBulkCreating}
                        sx={{ mr: 2 }}
                    >
                        Bulk Generate
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        onClick={() => setOpenSettingsDialog(true)}
                        sx={{ mr: 2 }}
                    >
                        Settings
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreate}
                    >
                        Add Fee
                    </Button>
                </Box>
            </Box>

            {/* Filters & Bulk Actions */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Class</InputLabel>
                            <Select
                                value={filters.classId}
                                label="Class"
                                onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))}
                            >
                                <MenuItem value=""><em>All Classes</em></MenuItem>
                                {classes?.map((cls) => (
                                    <MenuItem key={cls.id} value={cls.id}>
                                        {cls.name} - {cls.section}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filters.status}
                                label="Status"
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            >
                                <MenuItem value=""><em>All Statuses</em></MenuItem>
                                {statusOptions.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Academic Year"
                            value={filters.academicYear}
                            onChange={(e) => setFilters(prev => ({ ...prev, academicYear: e.target.value }))}
                        />
                    </Grid>
                    <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {selectedFees.length > 0 ? (
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<NotificationsIcon />}
                                onClick={handleSendSelectedReminders}
                                disabled={isSendingReminders}
                            >
                                Remind Selected ({selectedFees.length})
                            </Button>
                        ) : (
                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={<SendIcon />}
                                onClick={handleSendFilteredReminders}
                                disabled={isBulkSending}
                            >
                                Remind All Filtered
                            </Button>
                        )}
                    </Grid>
                </Grid>
            </Card>



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
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            indeterminate={selectedFees.length > 0 && selectedFees.length < (fees?.items.length || 0)}
                                            checked={fees?.items.length > 0 && selectedFees.length === fees?.items.length}
                                            onChange={handleSelectAll}
                                        />
                                    </TableCell>
                                    <TableCell>Student</TableCell>
                                    <TableCell>Fee Type</TableCell>
                                    <TableCell>Amount</TableCell>
                                    <TableCell>Paid</TableCell>
                                    <TableCell>Balance</TableCell>
                                    <TableCell>Due Date</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Receipt</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {fees.items.map((fee) => {
                                    const balance = fee.total_amount - fee.paid_amount - fee.discount_amount + fee.fine_amount;
                                    const isSelected = selectedFees.indexOf(fee.id) !== -1;
                                    return (
                                        <TableRow
                                            key={fee.id}
                                            hover
                                            sx={{ '&:last-child td': { borderBottom: 0 } }}
                                            selected={isSelected}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(event) => handleSelectOne(event, fee.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>
                                                        {fee.student?.first_name?.[0] || <PersonIcon />}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="subtitle2" fontWeight="bold">
                                                            {getStudentName(fee)}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                                            {fee.student?.admission_number || 'N/A'}
                                                        </Typography>
                                                        {fee.student?.class_details && (
                                                            <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                                {fee.student.class_details}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                                    {fee.fee_type.replace('_', ' ')}
                                                </Typography>
                                                {fee.academic_year && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {fee.academic_year}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">₹{fee.total_amount.toLocaleString()}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="success.main">₹{fee.paid_amount.toLocaleString()}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color={balance > 0 ? 'error.main' : 'text.secondary'}>
                                                    ₹{balance.toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : 'N/A'}
                                                </Typography>
                                            </TableCell>

                                            {/* Status Column */}
                                            <TableCell>
                                                <Chip
                                                    label={fee.status}
                                                    size="small"
                                                    color={statusOptions.find(o => o.value === fee.status)?.color as any || 'default'}
                                                    sx={{ textTransform: 'capitalize' }}
                                                />
                                            </TableCell>

                                            {/* Receipt Column - Only if paid > 0 */}
                                            <TableCell>
                                                {fee.paid_amount > 0 ? (
                                                    <IconButton size="small" onClick={() => handleSendReceipt(fee)} title="Send Receipt">
                                                        <ReceiptIcon fontSize="small" />
                                                    </IconButton>
                                                ) : '-'}
                                            </TableCell>

                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                                                    {/* Reminder Button (if pending/overdue) */}
                                                    {(fee.status === 'pending' || fee.status === 'overdue' || fee.status === 'partial') && (
                                                        <IconButton
                                                            size="small"
                                                            color="warning"
                                                            onClick={() => handleOpenReminder(fee)}
                                                            title="Send Reminder"
                                                            sx={{ bgcolor: 'warning.light', color: 'white', '&:hover': { bgcolor: 'warning.main' } }}
                                                        >
                                                            <NotificationsIcon fontSize="small" />
                                                        </IconButton>
                                                    )}

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
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => {
                                                            setDeleteConfirm(fee.id);
                                                        }}
                                                        title="Delete"
                                                    >
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

            {/* Pagination */}
            {fees && (
                <TablePagination
                    component="div"
                    count={fees.total}
                    page={page - 1} // TablePagination is 0-indexed
                    onPageChange={(_event, newPage) => setPage(newPage + 1)} // API is 1-indexed
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(1);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    labelRowsPerPage="Rows per page:"
                    showFirstButton
                    showLastButton
                />
            )}

            {/* Create Fee Dialog */}
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Fee Record</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Student</InputLabel>
                                <Select
                                    value={createForm.student_id}
                                    label="Student"
                                    onChange={(e) => setCreateForm({ ...createForm, student_id: e.target.value })}
                                >
                                    {students?.items?.map((s) => (
                                        <MenuItem key={s.id} value={s.id}>
                                            {s.first_name} {s.last_name} ({s.admission_number})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Fee Type</InputLabel>
                                <Select
                                    value={createForm.fee_type}
                                    label="Fee Type"
                                    onChange={(e) => setCreateForm({ ...createForm, fee_type: e.target.value })}
                                >
                                    {feeTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Total Amount"
                                type="number"
                                value={createForm.total_amount}
                                onChange={(e) => setCreateForm({ ...createForm, total_amount: parseFloat(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Academic Year"
                                value={createForm.academic_year}
                                onChange={(e) => setCreateForm({ ...createForm, academic_year: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Due Date"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={createForm.due_date}
                                onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Description"
                                value={createForm.description}
                                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create Fee'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Manual Payment Dialog */}
            <Dialog open={openPaymentDialog} onClose={() => setOpenPaymentDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogContent>
                    {selectedPayment && (
                        <Box sx={{ mb: 2, mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Student: <strong>{getStudentName(selectedPayment)}</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Total: ₹{selectedPayment.total_amount.toLocaleString()} | Paid: ₹{selectedPayment.paid_amount.toLocaleString()} | Balance: ₹{(selectedPayment.total_amount - selectedPayment.paid_amount - selectedPayment.discount_amount + selectedPayment.fine_amount).toLocaleString()}
                            </Typography>
                        </Box>
                    )}
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Amount"
                                type="number"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Payment Method</InputLabel>
                                <Select
                                    value={paymentForm.payment_method}
                                    label="Payment Method"
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                >
                                    {paymentMethods.map((m) => (
                                        <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Payment Reference (Cheque No / UPI Ref)"
                                value={paymentForm.payment_reference}
                                onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Notes"
                                multiline
                                rows={2}
                                value={paymentForm.notes}
                                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPaymentDialog(false)}>Cancel</Button>
                    <Button onClick={handleMakePayment} variant="contained" disabled={isPaying}>
                        {isPaying ? 'Processing...' : 'Record Payment'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Status Change Dialog */}
            <Dialog open={openStatusDialog} onClose={() => setOpenStatusDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Change Status</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={newStatus}
                            label="Status"
                            onChange={(e) => setNewStatus(e.target.value)}
                        >
                            {statusOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenStatusDialog(false)}>Cancel</Button>
                    <Button onClick={handleStatusChange} variant="contained" disabled={isUpdating}>
                        {isUpdating ? 'Updating...' : 'Update Status'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this fee record? This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button
                        onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                        variant="contained"
                        color="error"
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Online Payment Dialog */}
            {selectedPayment && (
                <PaymentCheckout
                    open={openOnlinePayment}
                    onClose={() => {
                        setOpenOnlinePayment(false);
                        setSelectedPayment(null);
                    }}
                    amount={selectedPayment.total_amount - selectedPayment.paid_amount - selectedPayment.discount_amount + selectedPayment.fine_amount}
                    purpose="fee_payment"
                    description={`${selectedPayment.fee_type} fee - ${getStudentName(selectedPayment)}`}
                    studentId={selectedPayment.student_id}
                    feePaymentId={selectedPayment.id}
                    payerName={selectedPayment.student ? `${selectedPayment.student.first_name} ${selectedPayment.student.last_name}` : ''}
                    onSuccess={() => {
                        setOpenOnlinePayment(false);
                        setSelectedPayment(null);
                        refetch();
                        refetchSummary();
                        toast.success('Online payment completed!');
                    }}
                    onFailure={(error) => {
                        toast.error(error || 'Online payment failed');
                    }}
                />
            )}

            {/* Reminder Dialog */}
            <ReminderDialog
                open={openReminderDialog}
                onClose={() => setOpenReminderDialog(false)}
                studentIds={reminderTargets.studentIds}
                feePaymentIds={reminderTargets.paymentIds}
                studentName={reminderTargets.studentName}
            />

            <ReminderSettingsDialog
                open={openSettingsDialog}
                onClose={() => setOpenSettingsDialog(false)}
            />

            <FeeStructureDialog
                open={openStructuresDialog}
                onClose={() => setOpenStructuresDialog(false)}
            />

            {/* Bulk Create Dialog — Supports Fee Structure or Manual Entry */}
            <Dialog open={openBulkCreateDialog} onClose={() => setOpenBulkCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Bulk Generate Fees for Class</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        {/* Fee Structure Selection (if any exist) */}
                        {feeStructures && feeStructures.length > 0 && (
                            <Grid item xs={12}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Fee Structure (auto-fills fields)</InputLabel>
                                    <Select
                                        value={selectedStructureId}
                                        label="Fee Structure (auto-fills fields)"
                                        onChange={(e) => handleStructureSelect(e.target.value)}
                                    >
                                        <MenuItem value=""><em>— Manual Entry —</em></MenuItem>
                                        {feeStructures.map((s) => (
                                            <MenuItem key={s.id} value={s.id}>
                                                {s.name} — ₹{s.total_amount.toLocaleString()}
                                                {s.course ? ` (${s.course})` : ''}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}

                        {/* Show structure breakdown when selected */}
                        {selectedStructureId && feeStructures?.find(s => s.id === selectedStructureId)?.fee_components?.length ? (
                            <Grid item xs={12}>
                                <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>FEE BREAKDOWN</Typography>
                                    {feeStructures?.find(s => s.id === selectedStructureId)?.fee_components?.map((c, i) => (
                                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                            <Typography variant="body2">{c.name}</Typography>
                                            <Typography variant="body2" fontWeight={600}>₹{c.amount.toLocaleString()}</Typography>
                                        </Box>
                                    ))}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="body2" fontWeight={700}>Total</Typography>
                                        <Typography variant="body2" fontWeight={700}>₹{bulkCreateForm.amount.toLocaleString()}</Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        ) : null}

                        {/* Class Selection — always required */}
                        <Grid item xs={12}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel>Class *</InputLabel>
                                <Select
                                    value={bulkCreateForm.class_id}
                                    label="Class *"
                                    onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, class_id: e.target.value })}
                                >
                                    {classes?.map((cls) => (
                                        <MenuItem key={cls.id} value={cls.id}>
                                            {cls.name} - {cls.section}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Fee details — editable in manual mode, read-only when structure selected */}
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Fee Type</InputLabel>
                                <Select
                                    value={bulkCreateForm.fee_type}
                                    label="Fee Type"
                                    onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, fee_type: e.target.value })}
                                    disabled={!!selectedStructureId}
                                >
                                    {feeTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Amount *"
                                type="number"
                                required
                                value={bulkCreateForm.amount || ''}
                                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, amount: parseFloat(e.target.value) || 0 })}
                                InputProps={{
                                    readOnly: !!selectedStructureId,
                                    sx: selectedStructureId ? { bgcolor: 'action.hover' } : {},
                                }}
                                helperText={selectedStructureId ? 'From fee structure' : 'Enter fee amount'}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Academic Year"
                                value={bulkCreateForm.academic_year}
                                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, academic_year: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Due Date"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={bulkCreateForm.due_date}
                                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, due_date: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Description"
                                value={bulkCreateForm.description}
                                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, description: e.target.value })}
                                InputProps={{
                                    readOnly: !!selectedStructureId,
                                    sx: selectedStructureId ? { bgcolor: 'action.hover' } : {},
                                }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Notes (optional)"
                                multiline
                                rows={2}
                                value={bulkCreateForm.notes}
                                onChange={(e) => setBulkCreateForm({ ...bulkCreateForm, notes: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenBulkCreateDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleBulkCreateSubmit}
                        variant="contained"
                        disabled={isBulkCreating || !bulkCreateForm.class_id || bulkCreateForm.amount <= 0}
                    >
                        {isBulkCreating ? 'Generating...' : 'Generate Fees'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FeesPage;
