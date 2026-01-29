import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, Tab, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
    Alert, Switch, FormControlLabel, CircularProgress, Skeleton, Snackbar
} from '@mui/material';
import {
    CreditCard as CreditCardIcon,
    Payment as PaymentIcon,
    Receipt as ReceiptIcon,
    Settings as SettingsIcon,
    CheckCircle as CheckIcon,
    Cancel as CancelIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import {
    useGetPaymentOrdersQuery,
    useGetPaymentStatsQuery,
    useGetGatewayConfigsQuery,
    useCreateGatewayConfigMutation,
    useCreateRefundMutation,
} from '../store/api/paymentApi';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const PaymentsPage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // Gateway config form state
    const [gatewayForm, setGatewayForm] = useState({
        gateway: 'razorpay',
        api_key_id: '',
        api_key_secret: '',
        webhook_secret: '',
        is_test_mode: true,
        is_active: true,
    });

    // API Queries
    const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useGetPaymentOrdersQuery({
        page,
        pageSize: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined,
    });
    const { data: statsData, isLoading: statsLoading } = useGetPaymentStatsQuery({});
    const { data: gatewayConfigs, isLoading: gatewaysLoading, refetch: refetchGateways } = useGetGatewayConfigsQuery();

    // Mutations
    const [createGatewayConfig, { isLoading: savingConfig }] = useCreateGatewayConfigMutation();
    const [createRefund] = useCreateRefundMutation();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'captured': return 'success';
            case 'pending': case 'created': return 'warning';
            case 'failed': case 'cancelled': return 'error';
            case 'refunded': case 'partially_refunded': return 'info';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'captured': return <CheckIcon fontSize="small" />;
            case 'failed': return <CancelIcon fontSize="small" />;
            default: return null;
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const handleRefund = async (transactionId: string) => {
        if (confirm('Are you sure you want to refund this payment?')) {
            try {
                await createRefund({ transaction_id: transactionId }).unwrap();
                setSnackbar({ open: true, message: 'Refund initiated successfully', severity: 'success' });
                refetchOrders();
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Refund failed', severity: 'error' });
            }
        }
    };

    const handleSaveGatewayConfig = async () => {
        if (!gatewayForm.api_key_id || !gatewayForm.api_key_secret) {
            setSnackbar({ open: true, message: 'Please enter API Key and Secret', severity: 'error' });
            return;
        }
        try {
            await createGatewayConfig({
                gateway: gatewayForm.gateway,
                api_key_id: gatewayForm.api_key_id,
                api_key_secret: gatewayForm.api_key_secret,
                webhook_secret: gatewayForm.webhook_secret || undefined,
                is_test_mode: gatewayForm.is_test_mode,
                is_active: gatewayForm.is_active,
            }).unwrap();
            setConfigDialogOpen(false);
            setGatewayForm({
                gateway: 'razorpay',
                api_key_id: '',
                api_key_secret: '',
                webhook_secret: '',
                is_test_mode: true,
                is_active: true,
            });
            setSnackbar({ open: true, message: 'Gateway configuration saved!', severity: 'success' });
            refetchGateways();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to save configuration', severity: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    <CreditCardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Online Payments
                </Typography>
                <Button variant="outlined" startIcon={<SettingsIcon />} onClick={() => setConfigDialogOpen(true)}>
                    Gateway Settings
                </Button>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                        <CardContent>
                            {statsLoading ? (
                                <Skeleton variant="text" width={100} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{formatCurrency(statsData?.total_collected || 0)}</Typography>
                            )}
                            <Typography>Total Collected</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                        <CardContent>
                            {statsLoading ? (
                                <Skeleton variant="text" width={100} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{formatCurrency(statsData?.total_pending || 0)}</Typography>
                            )}
                            <Typography>Pending</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
                        <CardContent>
                            {statsLoading ? (
                                <Skeleton variant="text" width={100} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{formatCurrency(statsData?.total_refunded || 0)}</Typography>
                            )}
                            <Typography>Refunded</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <CardContent>
                            {statsLoading ? (
                                <Skeleton variant="text" width={100} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{statsData?.success_rate?.toFixed(0) || 0}%</Typography>
                            )}
                            <Typography>Success Rate</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab icon={<PaymentIcon />} label="Transactions" />
                    <Tab icon={<ReceiptIcon />} label="Refunds" />
                    <Tab icon={<SettingsIcon />} label="Gateway Config" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                        <TextField size="small" placeholder="Search by order ID..." sx={{ minWidth: 250 }} />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Status</InputLabel>
                            <Select
                                label="Status"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="captured">Captured</MenuItem>
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="failed">Failed</MenuItem>
                                <MenuItem value="refunded">Refunded</MenuItem>
                            </Select>
                        </FormControl>
                        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => refetchOrders()}>
                            Refresh
                        </Button>
                    </Box>

                    {ordersLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : ordersData?.items?.length === 0 ? (
                        <Alert severity="info">No payment orders found.</Alert>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell>Order ID</TableCell>
                                        <TableCell>Payer</TableCell>
                                        <TableCell>Amount</TableCell>
                                        <TableCell>Purpose</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {ordersData?.items?.map(order => (
                                        <TableRow key={order.id} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontFamily="monospace">
                                                    {order.order_number}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{order.payer_name || '-'}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>
                                                {formatCurrency(order.total_amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={order.purpose || 'General'} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getStatusIcon(order.status) || undefined}
                                                    label={order.status}
                                                    color={getStatusColor(order.status) as any}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button size="small" variant="text">View</Button>
                                                {order.status === 'captured' && (
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleRefund(order.id)}
                                                    >
                                                        Refund
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Refunds are processed within 5-7 business days.
                    </Alert>
                    <Typography color="text.secondary">
                        Refund history will appear here once refunds are processed.
                    </Typography>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {gatewaysLoading ? (
                        <CircularProgress />
                    ) : (
                        <Grid container spacing={3}>
                            {gatewayConfigs?.map(config => (
                                <Grid item xs={12} md={6} key={config.id}>
                                    <Card sx={{ borderLeft: 4, borderColor: config.is_active ? 'success.main' : 'grey.400' }}>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Box>
                                                    <Typography variant="h6">{config.display_name || config.gateway}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {config.supported_methods?.join(', ')}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label={config.is_active ? 'Active' : 'Inactive'}
                                                    color={config.is_active ? 'success' : 'default'}
                                                    size="small"
                                                />
                                            </Box>
                                            <Chip
                                                label={config.is_test_mode ? 'Test Mode' : 'Live Mode'}
                                                color={config.is_test_mode ? 'warning' : 'success'}
                                                size="small"
                                                sx={{ mt: 2 }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                            {(!gatewayConfigs || gatewayConfigs.length === 0) && (
                                <Grid item xs={12}>
                                    <Alert severity="warning">
                                        No payment gateways configured. Click "Gateway Settings" to add one.
                                    </Alert>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </TabPanel>
            </Paper>

            {/* Config Dialog */}
            <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Configure Payment Gateway</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Keep your API keys secure. Never share them publicly.
                    </Alert>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Gateway</InputLabel>
                                <Select
                                    label="Gateway"
                                    value={gatewayForm.gateway}
                                    onChange={(e) => setGatewayForm({ ...gatewayForm, gateway: e.target.value })}
                                >
                                    <MenuItem value="razorpay">Razorpay</MenuItem>
                                    <MenuItem value="stripe">Stripe</MenuItem>
                                    <MenuItem value="paytm">Paytm</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="API Key ID"
                                placeholder="Enter API key..."
                                value={gatewayForm.api_key_id}
                                onChange={(e) => setGatewayForm({ ...gatewayForm, api_key_id: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                type="password"
                                label="API Key Secret"
                                placeholder="Enter secret key"
                                value={gatewayForm.api_key_secret}
                                onChange={(e) => setGatewayForm({ ...gatewayForm, api_key_secret: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Webhook Secret (Optional)"
                                placeholder="Enter webhook secret"
                                value={gatewayForm.webhook_secret}
                                onChange={(e) => setGatewayForm({ ...gatewayForm, webhook_secret: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={gatewayForm.is_test_mode}
                                        onChange={(e) => setGatewayForm({ ...gatewayForm, is_test_mode: e.target.checked })}
                                    />
                                }
                                label="Test Mode"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveGatewayConfig}
                        disabled={savingConfig}
                    >
                        {savingConfig ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default PaymentsPage;
