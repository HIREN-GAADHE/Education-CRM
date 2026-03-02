import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    Box, Typography, Tabs, Tab, Paper, Grid, Card, CardContent, CardActions,
    Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, CircularProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, IconButton,
    Divider, Tooltip, alpha, Autocomplete,
} from '@mui/material';
import {
    AccountBalance, PlayArrow, Receipt, Settings, Add, Edit,
    CheckCircle, HourglassEmpty, Block, Delete,
    TrendingUp, CurrencyRupee, People, DoneAll,
} from '@mui/icons-material';
import {
    useGetStructuresQuery, useCreateStructureMutation, useUpdateStructureMutation,
    useGetSalaryAssignmentsQuery, useCreateSalaryAssignmentMutation, useDeleteSalaryAssignmentMutation,
    useRunPayrollMutation,
    useGetPayslipsQuery, useUpdatePayslipStatusMutation, useUpdatePayslipAdjustmentsMutation,
    useDeletePayslipMutation, useBulkPayPayslipsMutation,
    useGetPayrollSummaryQuery,
    SalaryStructure, Payslip,
} from '../../store/api/payrollApi';
import { useGetStaffQuery } from '../../store/api/staffApi';
import { selectRoleLevel } from '../../store/slices/authSlice';
import { toast } from 'react-toastify';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS_COLOR: Record<string, any> = { pending: 'warning', paid: 'success', on_hold: 'error', cancelled: 'default' };
const STATUS_ICON: Record<string, any> = { pending: <HourglassEmpty fontSize="small" />, paid: <CheckCircle fontSize="small" />, on_hold: <Block fontSize="small" /> };

function fmt(n: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }

export default function Payroll() {
    const roleLevel = useSelector(selectRoleLevel);
    const isAdmin = roleLevel !== null && roleLevel <= 3;
    const isHR = roleLevel !== null && roleLevel <= 5;
    const isStaff = roleLevel !== null && roleLevel >= 7;

    const [tab, setTab] = useState(0);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #1a365d, #2b6cb0)' }}>
                    <AccountBalance sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Payroll Management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isStaff ? 'View your payslips & salary details' : 'Manage salary structures, run payroll, and track payments'}
                    </Typography>
                </Box>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}
                    sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Tab icon={<Receipt />} iconPosition="start" label="Payslips" />
                    {isHR && <Tab icon={<PlayArrow />} iconPosition="start" label="Run Payroll" />}
                    {isHR && <Tab icon={<Settings />} iconPosition="start" label="Salary Structures" />}
                    {isHR && <Tab icon={<People />} iconPosition="start" label="Assignments" />}
                </Tabs>
                <Box sx={{ p: 3 }}>
                    {tab === 0 && <PayslipsTab isHR={isHR} isAdmin={isAdmin} isStaff={isStaff} />}
                    {tab === 1 && isHR && <RunPayrollTab />}
                    {tab === 2 && isHR && <StructuresTab isAdmin={isAdmin} />}
                    {tab === 3 && isHR && <AssignmentsTab isAdmin={isAdmin} />}
                </Box>
            </Paper>
        </Box>
    );
}

// ─── Payslips Tab ─────────────────────────────────────────────────────────────
function PayslipsTab({ isHR, isAdmin, isStaff }: { isHR: boolean; isAdmin: boolean; isStaff: boolean }) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

    const { data, isLoading } = useGetPayslipsQuery({ month, year, status: statusFilter || undefined });
    const { data: summary } = useGetPayrollSummaryQuery({ month, year }, { skip: isStaff });
    const [updateStatus] = useUpdatePayslipStatusMutation();
    const [deletePayslip] = useDeletePayslipMutation();
    const [bulkPay, { isLoading: bulkPayLoading }] = useBulkPayPayslipsMutation();

    const payslips = data?.items ?? [];

    const handleMarkPaid = async (id: string) => {
        try {
            await updateStatus({ id, status: 'paid', payment_mode: 'bank_transfer' }).unwrap();
            toast.success('Marked as paid');
        } catch { toast.error('Failed to update status'); }
    };

    const handleOnHold = async (id: string) => {
        try {
            await updateStatus({ id, status: 'on_hold' }).unwrap();
            toast.success('Payslip put on hold');
        } catch { toast.error('Failed'); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this payslip? This cannot be undone.')) return;
        try {
            await deletePayslip(id).unwrap();
            toast.success('Payslip deleted');
        } catch (e: any) { toast.error(e?.data?.detail || 'Failed to delete'); }
    };

    const handleBulkPay = async () => {
        if (!window.confirm(`Mark ALL pending payslips for ${MONTHS[month - 1]} ${year} as paid?`)) return;
        try {
            const result = await bulkPay({ month, year }).unwrap();
            toast.success(`${result.marked_paid} payslips marked as paid`);
        } catch { toast.error('Bulk pay failed'); }
    };

    return (
        <Box>
            {/* Summary cards */}
            {summary && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {[
                        { label: 'Total Staff', value: summary.total_payslips, icon: <People />, color: '#4299e1' },
                        { label: 'Total Gross', value: fmt(summary.total_gross), icon: <CurrencyRupee />, color: '#ed8936' },
                        { label: 'Net Payable', value: fmt(summary.total_net), icon: <TrendingUp />, color: '#48bb78' },
                        { label: 'Paid', value: `${summary.paid_count}/${summary.total_payslips}`, icon: <CheckCircle />, color: '#9f7aea' },
                    ].map((item) => (
                        <Grid item xs={6} md={3} key={item.label}>
                            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(item.color, 0.12), color: item.color }}>
                                        {item.icon}
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                                        <Typography variant="subtitle1" fontWeight={700}>{item.value}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField select label="Month" size="small" value={month} onChange={(e) => setMonth(+e.target.value)} sx={{ width: 140 }}>
                    {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                </TextField>
                <TextField label="Year" type="number" size="small" value={year} onChange={(e) => setYear(+e.target.value)} sx={{ width: 100 }} />
                {isHR && (
                    <TextField select label="Status" size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 140 }}>
                        <MenuItem value="">All</MenuItem>
                        {['pending', 'paid', 'on_hold', 'cancelled'].map((s) => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</MenuItem>)}
                    </TextField>
                )}
                {isHR && summary && summary.pending_count > 0 && (
                    <Button variant="contained" color="success" startIcon={<DoneAll />} size="small"
                        onClick={handleBulkPay} disabled={bulkPayLoading}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, ml: 'auto' }}>
                        {bulkPayLoading ? 'Processing…' : `Mark All Pending as Paid (${summary.pending_count})`}
                    </Button>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ ml: summary?.pending_count ? 0 : 'auto' }}>
                    {payslips.length} payslip{payslips.length !== 1 ? 's' : ''}
                </Typography>
            </Box>

            {isLoading ? (
                <Box textAlign="center" py={6}><CircularProgress /></Box>
            ) : payslips.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No payslips for {MONTHS[month - 1]} {year}.
                    {isHR && ' Use the "Run Payroll" tab to generate them.'}
                </Alert>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell><strong>Staff</strong></TableCell>
                                <TableCell align="right"><strong>Base</strong></TableCell>
                                <TableCell align="right"><strong>Gross</strong></TableCell>
                                <TableCell align="right"><strong>Deductions</strong></TableCell>
                                <TableCell align="right"><strong>Net Pay</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                {isHR && <TableCell align="center"><strong>Actions</strong></TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {payslips.map((p) => (
                                <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedPayslip(p)}>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{p.staff_name}</Typography>
                                        {p.staff_designation && <Typography variant="caption" color="text.secondary">{p.staff_designation}</Typography>}
                                    </TableCell>
                                    <TableCell align="right">{fmt(p.base_salary)}</TableCell>
                                    <TableCell align="right">{fmt(p.gross_salary)}</TableCell>
                                    <TableCell align="right" sx={{ color: 'error.main' }}>-{fmt(p.total_deductions)}</TableCell>
                                    <TableCell align="right">
                                        <Typography fontWeight={700} color="success.main">{fmt(p.net_salary)}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip icon={STATUS_ICON[p.status]} label={p.status.replace('_', ' ')} size="small" color={STATUS_COLOR[p.status]} />
                                    </TableCell>
                                    {isHR && (
                                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                {p.status === 'pending' && (
                                                    <>
                                                        <Tooltip title="Mark Paid">
                                                            <IconButton size="small" color="success" onClick={() => handleMarkPaid(p.id)}>
                                                                <CheckCircle fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Put On Hold">
                                                            <IconButton size="small" color="warning" onClick={() => handleOnHold(p.id)}>
                                                                <Block fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                                {isAdmin && p.status !== 'paid' && (
                                                    <Tooltip title="Delete Payslip">
                                                        <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Payslip Detail Dialog */}
            <PayslipDetailDialog
                payslip={selectedPayslip}
                isHR={isHR}
                onClose={() => setSelectedPayslip(null)}
            />
        </Box>
    );
}

function PayslipDetailDialog({ payslip, isHR, onClose }: { payslip: Payslip | null; isHR: boolean; onClose: () => void }) {
    const [updateAdj, { isLoading }] = useUpdatePayslipAdjustmentsMutation();
    const [adj, setAdj] = useState({ loss_of_pay_days: 0, bonus: 0, advance_deduction: 0, days_worked: 26 });

    // ── Fix Bug #4: Initialize adjustments from payslip data ──────────────
    useEffect(() => {
        if (payslip) {
            setAdj({
                loss_of_pay_days: payslip.loss_of_pay_days ?? 0,
                bonus: payslip.bonus ?? 0,
                advance_deduction: payslip.advance_deduction ?? 0,
                days_worked: payslip.days_worked ?? 26,
            });
        }
    }, [payslip]);

    if (!payslip) return null;

    const canAdjust = isHR && payslip.status !== 'paid';

    const handleSaveAdj = async () => {
        try {
            await updateAdj({ id: payslip.id, ...adj }).unwrap();
            toast.success('Adjustments saved');
            onClose();
        } catch { toast.error('Failed to save adjustments'); }
    };

    return (
        <Dialog open={!!payslip} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle>
                <Typography fontWeight={700}>Payslip — {payslip.staff_name}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {MONTHS[payslip.month - 1]} {payslip.year}
                    {payslip.structure_name && ` • ${payslip.structure_name}`}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={1.5}>
                    {/* Earnings */}
                    <Grid item xs={12}><Typography variant="overline" color="text.secondary" fontWeight={700}>Earnings</Typography></Grid>
                    <Grid item xs={6}><Typography variant="body2">Base Salary</Typography></Grid>
                    <Grid item xs={6} textAlign="right"><Typography variant="body2" fontWeight={600}>{fmt(payslip.base_salary)}</Typography></Grid>
                    {Object.entries(payslip.allowances_breakdown).map(([k, v]) => (
                        <React.Fragment key={k}>
                            <Grid item xs={6}><Typography variant="body2" color="text.secondary">{k.toUpperCase()}</Typography></Grid>
                            <Grid item xs={6} textAlign="right"><Typography variant="body2">+{fmt(v)}</Typography></Grid>
                        </React.Fragment>
                    ))}
                    {payslip.bonus > 0 && <>
                        <Grid item xs={6}><Typography variant="body2" color="success.main">Bonus</Typography></Grid>
                        <Grid item xs={6} textAlign="right"><Typography variant="body2" color="success.main">+{fmt(payslip.bonus)}</Typography></Grid>
                    </>}
                    <Grid item xs={12}><Box sx={{ bgcolor: 'success.light', borderRadius: 1, px: 1.5, py: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                        <Typography fontWeight={700}>Gross Salary</Typography>
                        <Typography fontWeight={700}>{fmt(payslip.gross_salary)}</Typography>
                    </Box></Grid>

                    {/* Deductions */}
                    <Grid item xs={12} sx={{ mt: 1 }}><Typography variant="overline" color="text.secondary" fontWeight={700}>Deductions</Typography></Grid>
                    {Object.entries(payslip.deductions_breakdown).map(([k, v]) => (
                        <React.Fragment key={k}>
                            <Grid item xs={6}><Typography variant="body2" color="text.secondary">{k.toUpperCase()}</Typography></Grid>
                            <Grid item xs={6} textAlign="right"><Typography variant="body2" color="error.main">-{fmt(v)}</Typography></Grid>
                        </React.Fragment>
                    ))}
                    {payslip.loss_of_pay_amount > 0 && <>
                        <Grid item xs={6}><Typography variant="body2" color="error.main">Loss of Pay ({payslip.loss_of_pay_days} days)</Typography></Grid>
                        <Grid item xs={6} textAlign="right"><Typography variant="body2" color="error.main">-{fmt(payslip.loss_of_pay_amount)}</Typography></Grid>
                    </>}
                    {payslip.advance_deduction > 0 && <>
                        <Grid item xs={6}><Typography variant="body2" color="error.main">Advance Recovery</Typography></Grid>
                        <Grid item xs={6} textAlign="right"><Typography variant="body2" color="error.main">-{fmt(payslip.advance_deduction)}</Typography></Grid>
                    </>}

                    <Grid item xs={12}><Box sx={{ bgcolor: 'primary.light', borderRadius: 1, px: 1.5, py: 0.75, display: 'flex', justifyContent: 'space-between' }}>
                        <Typography fontWeight={700} variant="subtitle1">Net Salary</Typography>
                        <Typography fontWeight={700} variant="subtitle1" color="primary.dark">{fmt(payslip.net_salary)}</Typography>
                    </Box></Grid>

                    {/* Adjustments (for HR on pending payslips) */}
                    {canAdjust && (
                        <>
                            <Grid item xs={12} sx={{ mt: 1 }}>
                                <Divider />
                                <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mt={1}>Adjustments</Typography>
                            </Grid>
                            <Grid item xs={6}><TextField type="number" fullWidth label="LOP Days" size="small" value={adj.loss_of_pay_days} onChange={(e) => setAdj({ ...adj, loss_of_pay_days: +e.target.value })} inputProps={{ min: 0 }} /></Grid>
                            <Grid item xs={6}><TextField type="number" fullWidth label="Days Worked" size="small" value={adj.days_worked} onChange={(e) => setAdj({ ...adj, days_worked: +e.target.value })} /></Grid>
                            <Grid item xs={6}><TextField type="number" fullWidth label="Bonus (₹)" size="small" value={adj.bonus} onChange={(e) => setAdj({ ...adj, bonus: +e.target.value })} /></Grid>
                            <Grid item xs={6}><TextField type="number" fullWidth label="Advance Deduction (₹)" size="small" value={adj.advance_deduction} onChange={(e) => setAdj({ ...adj, advance_deduction: +e.target.value })} /></Grid>
                        </>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3 }}>
                <Chip label={`Status: ${payslip.status.replace('_', ' ')}`} color={STATUS_COLOR[payslip.status]} size="small" sx={{ mr: 'auto' }} />
                <Button onClick={onClose}>Close</Button>
                {canAdjust && (
                    <Button variant="contained" onClick={handleSaveAdj} disabled={isLoading}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        Save Adjustments
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

// ─── Run Payroll Tab ──────────────────────────────────────────────────────────
function RunPayrollTab() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [workingDays, setWorkingDays] = useState(26);
    const [runPayroll, { isLoading, data: result }] = useRunPayrollMutation();

    const { data: summary, refetch } = useGetPayrollSummaryQuery({ month, year });

    const handleRun = async () => {
        try {
            await runPayroll({ month, year, working_days: workingDays }).unwrap();
            toast.success('Payroll run complete!');
            refetch();
        } catch { toast.error('Payroll run failed'); }
    };

    return (
        <Box sx={{ maxWidth: 560 }}>
            <Alert severity="info" sx={{ borderRadius: 2, mb: 3 }}>
                Running payroll generates payslips for all staff with active salary assignments.
                Staff who already have a payslip for this month will be skipped.
            </Alert>

            <Grid container spacing={2}>
                <Grid item xs={12} sm={5}>
                    <TextField select fullWidth label="Month" size="small" value={month} onChange={(e) => setMonth(+e.target.value)}>
                        {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <TextField type="number" fullWidth label="Year" size="small" value={year} onChange={(e) => setYear(+e.target.value)} />
                </Grid>
                <Grid item xs={6} sm={4}>
                    <TextField type="number" fullWidth label="Working Days" size="small" value={workingDays} onChange={(e) => setWorkingDays(+e.target.value)} inputProps={{ min: 1, max: 31 }} />
                </Grid>
            </Grid>

            {summary && (
                <Box sx={{ my: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="body2" color="text.secondary">
                        {MONTHS[month - 1]} {year} — <strong>{summary.total_payslips}</strong> payslips (
                        <span style={{ color: '#48bb78' }}>{summary.paid_count} paid</span>,{' '}
                        <span style={{ color: '#ed8936' }}>{summary.pending_count} pending</span>
                        {summary.on_hold_count > 0 && <>, <span style={{ color: '#e53e3e' }}>{summary.on_hold_count} on hold</span></>})
                    </Typography>
                </Box>
            )}

            <Button variant="contained" startIcon={<PlayArrow />} onClick={handleRun}
                disabled={isLoading}
                sx={{
                    mt: 2, borderRadius: 2, textTransform: 'none', fontWeight: 700,
                    background: 'linear-gradient(135deg, #1a365d, #2b6cb0)', px: 4
                }}>
                {isLoading ? 'Running…' : `Run Payroll for ${MONTHS[month - 1]} ${year}`}
            </Button>

            {result && (
                <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
                    {result.message}
                </Alert>
            )}
        </Box>
    );
}

// ─── Salary Structures Tab ─────────────────────────────────────────────────────
function StructuresTab({ isAdmin: _isAdmin }: { isAdmin: boolean }) {
    const { data: structures = [], isLoading } = useGetStructuresQuery({});
    const [createStruct, { isLoading: isCreating }] = useCreateStructureMutation();
    const [updateStruct] = useUpdateStructureMutation();
    const [open, setOpen] = useState(false);
    const [editItem, setEditItem] = useState<SalaryStructure | null>(null);
    const defaultForm = {
        name: '', description: '', base_salary: '', is_active: true,
        allowances: { HRA: { type: 'percent', value: 20 }, DA: { type: 'percent', value: 10 }, TA: { type: 'fixed', value: 1000 } },
        deductions: { PF: { type: 'percent', value: 12 }, TDS: { type: 'percent', value: 10 } },
    };
    const [form, setForm] = useState<any>(defaultForm);

    const openCreate = () => { setForm(defaultForm); setEditItem(null); setOpen(true); };
    const openEdit = (s: SalaryStructure) => {
        setForm({ ...s, base_salary: String(s.base_salary) });
        setEditItem(s);
        setOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.base_salary) { toast.error('Name and base salary are required'); return; }
        try {
            const payload = { ...form, base_salary: parseFloat(form.base_salary) };
            if (editItem) {
                await updateStruct({ id: editItem.id, data: payload }).unwrap();
                toast.success('Structure updated');
            } else {
                await createStruct(payload).unwrap();
                toast.success('Structure created');
            }
            setOpen(false);
        } catch { toast.error('Failed to save structure'); }
    };

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    New Structure
                </Button>
            </Box>

            {structures.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No salary structures yet. Create one to begin.</Alert>
            ) : (
                <Grid container spacing={2}>
                    {structures.map((s) => (
                        <Grid item xs={12} md={6} key={s.id}>
                            <Card elevation={0} sx={{ border: '1px solid', borderColor: s.is_active ? 'success.light' : 'divider', borderRadius: 3 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>{s.name}</Typography>
                                        <Chip label={s.is_active ? 'Active' : 'Inactive'} size="small" color={s.is_active ? 'success' : 'default'} />
                                    </Box>
                                    <Typography variant="h6" color="primary" fontWeight={800}>{fmt(s.base_salary)} <Typography component="span" variant="caption" color="text.secondary">/ month</Typography></Typography>
                                    {s.description && <Typography variant="body2" color="text.secondary" mt={0.5}>{s.description}</Typography>}
                                    <Divider sx={{ my: 1.5 }} />
                                    <Grid container spacing={1}>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="success.main" fontWeight={700}>ALLOWANCES</Typography>
                                            {Object.entries(s.allowances).map(([k, v]) => (
                                                <Typography key={k} variant="body2">{k}: {v.type === 'percent' ? `${v.value}%` : fmt(v.value)}</Typography>
                                            ))}
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="error.main" fontWeight={700}>DEDUCTIONS</Typography>
                                            {Object.entries(s.deductions).map(([k, v]) => (
                                                <Typography key={k} variant="body2">{k}: {v.type === 'percent' ? `${v.value}%` : fmt(v.value)}</Typography>
                                            ))}
                                        </Grid>
                                    </Grid>
                                </CardContent>
                                <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                                    <Button size="small" startIcon={<Edit />} onClick={() => openEdit(s)} sx={{ textTransform: 'none' }}>Edit</Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>{editItem ? 'Edit' : 'New'} Salary Structure</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={8}>
                            <TextField fullWidth label="Structure Name *" size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField type="number" fullWidth label="Base Salary (₹) *" size="small" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Description" size="small" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </Grid>
                        <Grid item xs={12}>
                            <Alert severity="info" sx={{ borderRadius: 1 }}>
                                <Typography variant="caption">
                                    Allowances & deductions are stored as JSON. Edit allowances/deductions in the text boxes below.
                                    Type: <strong>"percent"</strong> (of gross) or <strong>"fixed"</strong> (flat ₹ amount).
                                </Typography>
                            </Alert>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Allowances (JSON)" size="small" multiline rows={4}
                                value={JSON.stringify(form.allowances, null, 2)}
                                onChange={(e) => { try { setForm({ ...form, allowances: JSON.parse(e.target.value) }); } catch { } }}
                                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Deductions (JSON)" size="small" multiline rows={4}
                                value={JSON.stringify(form.deductions, null, 2)}
                                onChange={(e) => { try { setForm({ ...form, deductions: JSON.parse(e.target.value) }); } catch { } }}
                                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Chip label={form.is_active ? 'Active' : 'Inactive'}
                                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                                color={form.is_active ? 'success' : 'default'}
                                sx={{ cursor: 'pointer' }} />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={isCreating}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isCreating ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ─── Assignments Tab ───────────────────────────────────────────────────────────
function AssignmentsTab({ isAdmin }: { isAdmin: boolean }) {
    const { data: assignments = [], isLoading } = useGetSalaryAssignmentsQuery({});
    const { data: structures = [] } = useGetStructuresQuery({ is_active: true });
    const [createAssignment, { isLoading: isCreating }] = useCreateSalaryAssignmentMutation();
    const [deleteAssignment] = useDeleteSalaryAssignmentMutation();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<any>({
        effective_from: new Date().toISOString().split('T')[0],
        bank_name: '', bank_account_number: '', ifsc_code: '', pan_number: '',
    });
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [selectedStructure, setSelectedStructure] = useState<any>(null);

    const handleSave = async () => {
        if (!selectedStaff || !selectedStructure) { toast.error('Select staff and structure'); return; }
        try {
            await createAssignment({
                ...form,
                staff_id: selectedStaff.id,
                structure_id: selectedStructure.id,
                custom_base_salary: form.custom_base_salary ? parseFloat(form.custom_base_salary) : undefined,
            }).unwrap();
            toast.success('Assignment created');
            setOpen(false);
        } catch { toast.error('Failed to create assignment'); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this salary assignment?')) return;
        try {
            await deleteAssignment(id).unwrap();
            toast.success('Assignment deleted');
        } catch (e: any) { toast.error(e?.data?.detail || 'Failed to delete'); }
    };

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    Assign Salary
                </Button>
            </Box>

            {assignments.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No salary assignments yet. Assign a salary structure to staff to run payroll.</Alert>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell><strong>Staff</strong></TableCell>
                                <TableCell><strong>Structure</strong></TableCell>
                                <TableCell align="right"><strong>Effective Base</strong></TableCell>
                                <TableCell><strong>From</strong></TableCell>
                                <TableCell><strong>To</strong></TableCell>
                                <TableCell><strong>Bank</strong></TableCell>
                                {isAdmin && <TableCell align="center"><strong>Actions</strong></TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {assignments.map((a) => (
                                <TableRow key={a.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{a.staff_name}</Typography>
                                        {a.staff_designation && <Typography variant="caption" color="text.secondary">{a.staff_designation}</Typography>}
                                    </TableCell>
                                    <TableCell>{a.structure_name || '—'}</TableCell>
                                    <TableCell align="right">
                                        {a.custom_base_salary ? fmt(a.custom_base_salary) : '(structure default)'}
                                    </TableCell>
                                    <TableCell>{a.effective_from}</TableCell>
                                    <TableCell>{a.effective_to || <Chip label="Current" size="small" color="success" />}</TableCell>
                                    <TableCell>
                                        {a.bank_name ? `${a.bank_name} ····${a.bank_account_number?.slice(-4)}` : '—'}
                                    </TableCell>
                                    {isAdmin && (
                                        <TableCell align="center">
                                            <Tooltip title="Delete Assignment">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(a.id)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Assign Salary Structure</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12}>
                            <StaffAutocomplete value={selectedStaff} onChange={setSelectedStaff} />
                        </Grid>
                        <Grid item xs={12}>
                            <Autocomplete
                                options={structures}
                                getOptionLabel={(s) => `${s.name} (₹${s.base_salary.toLocaleString('en-IN')})`}
                                value={selectedStructure}
                                onChange={(_, v) => setSelectedStructure(v)}
                                renderInput={(p) => <TextField {...p} label="Salary Structure *" size="small" />}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField type="date" fullWidth label="Effective From *" size="small" InputLabelProps={{ shrink: true }}
                                value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField type="number" fullWidth label="Custom Base Salary (optional)" size="small"
                                placeholder="Leave blank to use structure default"
                                value={form.custom_base_salary || ''} onChange={(e) => setForm({ ...form, custom_base_salary: e.target.value })} />
                        </Grid>
                        <Grid item xs={12}><Typography variant="overline" color="text.secondary">Bank Details</Typography></Grid>
                        <Grid item xs={6}><TextField fullWidth label="Bank Name" size="small" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="Account Number" size="small" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="IFSC Code" size="small" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="PAN Number" size="small" value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value })} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={isCreating}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isCreating ? 'Assigning…' : 'Assign'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ─── Staff Autocomplete helper (FIXED: uses real staff API, not students) ─────
function StaffAutocomplete({ value, onChange }: { value: any; onChange: (v: any) => void }) {
    const { data: staffData } = useGetStaffQuery({ page: 1, page_size: 500 });
    const staffList = staffData?.items ?? [];

    const options = staffList.map((s) => ({
        id: s.id,
        label: `${s.first_name} ${s.last_name}`,
        designation: s.designation || '',
        employee_id: s.employee_id,
    }));

    return (
        <Autocomplete
            options={options}
            getOptionLabel={(s: any) => `${s.label} (${s.employee_id})`}
            isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
            value={value}
            onChange={(_, v) => onChange(v)}
            renderOption={(props, option: any) => (
                <Box component="li" {...props}>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.employee_id} {option.designation && `• ${option.designation}`}</Typography>
                    </Box>
                </Box>
            )}
            renderInput={(p) => <TextField {...p} label="Staff Member *" size="small" />}
            noOptionsText="No staff found"
        />
    );
}
