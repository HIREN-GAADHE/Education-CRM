import React, { useState } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Avatar, Chip,
    CircularProgress, Alert, Tabs, Tab, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Paper,
    LinearProgress, Skeleton, Button
} from '@mui/material';
import {
    Person as PersonIcon,
    EventNote as AttendanceIcon,
    Grade as GradeIcon,
    Payment as PaymentIcon,
    Schedule as TimetableIcon,
    CheckCircle as CheckIcon
} from '@mui/icons-material';
import {
    useGetChildrenQuery,
    useGetChildAttendanceQuery,
    useGetChildFeesQuery,
    useGetChildGradesQuery,
    useGetChildTimetableQuery,
} from '../store/api/portalApi';
import { PaymentCheckout } from '../components/payment';

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

const ParentDashboard: React.FC = () => {
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [selectedFee, setSelectedFee] = useState<any>(null);

    // Fetch children
    const { data: children, isLoading: childrenLoading, error } = useGetChildrenQuery();

    // Select first child by default
    const activeChildId = selectedChildId || children?.[0]?.id;

    // Fetch child data
    const { data: attendance, isLoading: attLoading } = useGetChildAttendanceQuery(
        activeChildId!, { skip: !activeChildId }
    );
    const { data: fees, isLoading: feesLoading } = useGetChildFeesQuery(
        activeChildId!, { skip: !activeChildId }
    );
    const { data: grades, isLoading: gradesLoading } = useGetChildGradesQuery(
        activeChildId!, { skip: !activeChildId }
    );
    const { data: timetable, isLoading: timetableLoading } = useGetChildTimetableQuery(
        activeChildId!, { skip: !activeChildId }
    );

    const handlePayFee = (fee: any) => {
        setSelectedFee(fee);
        setPaymentOpen(true);
    };

    const handlePaymentSuccess = () => {
        setPaymentOpen(false);
        setSelectedFee(null);
        // Refetch fees after payment
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const activeChild = children?.find(c => c.id === activeChildId);

    if (childrenLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !children?.length) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="info">
                    No children linked to your account. Please contact the school administration.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Parent Portal
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Welcome! View your children's academic progress and fee status.
            </Typography>

            {/* Child Selector */}
            {children.length > 1 && (
                <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {children.map(child => (
                        <Card
                            key={child.id}
                            sx={{
                                cursor: 'pointer',
                                border: activeChildId === child.id ? 2 : 1,
                                borderColor: activeChildId === child.id ? 'primary.main' : 'grey.300',
                                minWidth: 200
                            }}
                            onClick={() => setSelectedChildId(child.id)}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar src={child.avatar_url || undefined}>
                                    {child.full_name[0]}
                                </Avatar>
                                <Box>
                                    <Typography fontWeight="bold">{child.full_name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {child.course} - {child.section}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </Box>
            )}

            {/* Active Child Summary */}
            {activeChild && (
                <Card sx={{
                    mb: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 3,
                    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
                }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 3 }}>
                        <Avatar
                            src={activeChild.avatar_url || undefined}
                            sx={{
                                width: 90,
                                height: 90,
                                fontSize: '2.5rem',
                                bgcolor: 'white',
                                color: '#667eea',
                                border: '3px solid rgba(255,255,255,0.3)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                            }}
                        >
                            {activeChild.full_name[0]}
                        </Avatar>
                        <Box>
                            <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>{activeChild.full_name}</Typography>
                            <Typography sx={{ opacity: 0.9 }}>Admission #: {activeChild.admission_number}</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                <Chip
                                    label={activeChild.course || 'N/A'}
                                    size="small"
                                    sx={{ bgcolor: 'white', color: '#667eea', fontWeight: 'bold' }}
                                />
                                <Chip
                                    label={`Year ${activeChild.year || '-'}`}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <AttendanceIcon color="primary" />
                                <Typography color="text.secondary">Attendance</Typography>
                            </Box>
                            {attLoading ? (
                                <Skeleton variant="text" width={80} />
                            ) : (
                                <>
                                    <Typography variant="h4" fontWeight="bold" color={(attendance?.percentage ?? 0) >= 75 ? 'success.main' : 'error.main'}>
                                        {attendance?.percentage?.toFixed(0) || 0}%
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={attendance?.percentage || 0}
                                        color={(attendance?.percentage ?? 0) >= 75 ? 'success' : 'error'}
                                        sx={{ mt: 1, height: 6, borderRadius: 3 }}
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <PaymentIcon color="warning" />
                                <Typography color="text.secondary">Pending Fees</Typography>
                            </Box>
                            {feesLoading ? (
                                <Skeleton variant="text" width={100} />
                            ) : (
                                <Typography variant="h4" fontWeight="bold" color={(fees?.pending_amount || 0) > 0 ? 'error.main' : 'success.main'}>
                                    {formatCurrency(fees?.pending_amount || 0)}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CheckIcon color="success" />
                                <Typography color="text.secondary">Fees Paid</Typography>
                            </Box>
                            {feesLoading ? (
                                <Skeleton variant="text" width={100} />
                            ) : (
                                <Typography variant="h4" fontWeight="bold" color="success.main">
                                    {formatCurrency(fees?.paid_amount || 0)}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <GradeIcon color="info" />
                                <Typography color="text.secondary">Recent Exams</Typography>
                            </Box>
                            {gradesLoading ? (
                                <Skeleton variant="text" width={50} />
                            ) : (
                                <Typography variant="h4" fontWeight="bold">
                                    {grades?.length || 0}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tabs for detailed data */}
            <Paper>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab icon={<GradeIcon />} label="Grades" />
                    <Tab icon={<AttendanceIcon />} label="Attendance" />
                    <Tab icon={<PaymentIcon />} label="Fees" />
                    <Tab icon={<TimetableIcon />} label="Timetable" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    {gradesLoading ? (
                        <CircularProgress />
                    ) : grades?.length === 0 ? (
                        <Alert severity="info">No exam results available yet.</Alert>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell>Exam</TableCell>
                                        <TableCell>Subject</TableCell>
                                        <TableCell align="right">Marks</TableCell>
                                        <TableCell align="right">Percentage</TableCell>
                                        <TableCell>Grade</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {grades?.map((g, idx) => (
                                        <TableRow key={idx} hover>
                                            <TableCell>{g.exam_name}</TableCell>
                                            <TableCell>{g.course_name || '-'}</TableCell>
                                            <TableCell align="right">{g.marks_obtained}/{g.max_marks}</TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={`${g.percentage.toFixed(0)}%`}
                                                    size="small"
                                                    color={g.percentage >= 60 ? 'success' : g.percentage >= 40 ? 'warning' : 'error'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography fontWeight="bold">{g.grade || '-'}</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    {attLoading ? (
                        <CircularProgress />
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={6} sm={3}>
                                <Card sx={{ bgcolor: 'success.light' }}>
                                    <CardContent>
                                        <Typography variant="h4" fontWeight="bold">{attendance?.present_days || 0}</Typography>
                                        <Typography>Present Days</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Card sx={{ bgcolor: 'error.light' }}>
                                    <CardContent>
                                        <Typography variant="h4" fontWeight="bold">{attendance?.absent_days || 0}</Typography>
                                        <Typography>Absent Days</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Card sx={{ bgcolor: 'warning.light' }}>
                                    <CardContent>
                                        <Typography variant="h4" fontWeight="bold">{attendance?.late_days || 0}</Typography>
                                        <Typography>Late Days</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Card sx={{ bgcolor: 'info.light' }}>
                                    <CardContent>
                                        <Typography variant="h4" fontWeight="bold">{attendance?.total_days || 0}</Typography>
                                        <Typography>Total Days</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {feesLoading ? (
                        <CircularProgress />
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Fee Summary</Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography>Total Fees:</Typography>
                                            <Typography fontWeight="bold">{formatCurrency(fees?.total_fees || 0)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography>Paid:</Typography>
                                            <Typography fontWeight="bold" color="success.main">{formatCurrency(fees?.paid_amount || 0)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography>Pending:</Typography>
                                            <Typography fontWeight="bold" color="warning.main">{formatCurrency(fees?.pending_amount || 0)}</Typography>
                                        </Box>
                                        {(fees?.overdue_amount || 0) > 0 && (
                                            <Alert severity="error" sx={{ mt: 2 }}>
                                                Overdue Amount: {formatCurrency(fees?.overdue_amount || 0)}
                                            </Alert>
                                        )}
                                        {(fees?.pending_amount || 0) > 0 && (
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                fullWidth
                                                sx={{ mt: 2 }}
                                                onClick={() => handlePayFee({
                                                    id: activeChildId,
                                                    balance: fees?.pending_amount || 0,
                                                    fee_type: 'pending_fees'
                                                })}
                                            >
                                                Pay Now ({formatCurrency(fees?.pending_amount || 0)})
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={3}>
                    {timetableLoading ? (
                        <CircularProgress />
                    ) : !timetable?.length ? (
                        <Alert severity="info">
                            Timetable view will be available here once configured.
                        </Alert>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell>Day</TableCell>
                                        <TableCell>Time</TableCell>
                                        <TableCell>Subject</TableCell>
                                        <TableCell>Teacher</TableCell>
                                        <TableCell>Room</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {timetable?.map((slot: any, idx: number) => (
                                        <TableRow key={idx} hover>
                                            <TableCell>
                                                <Chip
                                                    label={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][slot.day - 1] || slot.day}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>{slot.start_time} - {slot.end_time}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>{slot.course_name || '-'}</TableCell>
                                            <TableCell>{slot.teacher_name || '-'}</TableCell>
                                            <TableCell>{slot.room || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>
            </Paper>

            {/* Payment Checkout */}
            {selectedFee && activeChild && (
                <PaymentCheckout
                    open={paymentOpen}
                    onClose={() => { setPaymentOpen(false); setSelectedFee(null); }}
                    amount={selectedFee.balance}
                    purpose="fee_payment"
                    description={`Fee Payment for ${activeChild.full_name}`}
                    feePaymentId={selectedFee.id}
                    payerName={activeChild.full_name}
                    payerEmail=""
                    payerPhone=""
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </Box>
    );
};

export default ParentDashboard;

