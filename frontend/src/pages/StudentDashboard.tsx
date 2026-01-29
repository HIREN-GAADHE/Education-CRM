import React, { useState } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Avatar, Chip,
    CircularProgress, Alert, Tabs, Tab, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Paper,
    LinearProgress, Button
} from '@mui/material';
import {
    School as SchoolIcon,
    EventNote as AttendanceIcon,
    Grade as GradeIcon,
    Payment as PaymentIcon,
    Schedule as TimetableIcon,
    CardMembership as CertificateIcon,
    Download as DownloadIcon,
    CheckCircle as CheckIcon
} from '@mui/icons-material';
import {
    useGetStudentDashboardQuery,
    useGetStudentProfileQuery,
    useGetStudentFeesQuery,
    useGetStudentGradesQuery,
    useGetStudentCertificatesQuery,
    useGetStudentTimetableQuery,
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

const StudentDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [selectedFee, setSelectedFee] = useState<any>(null);

    // Fetch student data
    const { data: dashboard, isLoading: dashLoading, error } = useGetStudentDashboardQuery();
    const { data: profile, isLoading: profileLoading } = useGetStudentProfileQuery();
    const { data: fees, isLoading: feesLoading, refetch: refetchFees } = useGetStudentFeesQuery();
    const { data: grades, isLoading: gradesLoading } = useGetStudentGradesQuery();
    const { data: certificates, isLoading: certsLoading } = useGetStudentCertificatesQuery();
    const { data: timetable, isLoading: timetableLoading } = useGetStudentTimetableQuery();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const handlePayFee = (fee: any) => {
        setSelectedFee(fee);
        setPaymentOpen(true);
    };

    const handlePaymentSuccess = () => {
        setPaymentOpen(false);
        setSelectedFee(null);
        refetchFees();
    };

    if (dashLoading || profileLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    No student record linked to your account. Please contact the school administration.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Student Portal
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Welcome back, {dashboard?.profile_name || 'Student'}!
            </Typography>

            {/* Profile Card */}
            <Card sx={{
                mb: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: 3,
                boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
            }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 3 }}>
                    <Avatar
                        src={profile?.avatar_url || undefined}
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
                        {profile?.full_name?.[0] || 'S'}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>{profile?.full_name}</Typography>
                        <Typography sx={{ opacity: 0.9 }}>Admission #: {profile?.admission_number}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                            <Chip
                                label={profile?.course || 'N/A'}
                                size="small"
                                sx={{
                                    bgcolor: 'white',
                                    color: '#667eea',
                                    fontWeight: 'bold'
                                }}
                            />
                            <Chip
                                label={`Year ${profile?.year || '-'}`}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                            />
                            <Chip
                                label={profile?.section || 'N/A'}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                            />
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <AttendanceIcon color="primary" />
                                <Typography color="text.secondary">Attendance</Typography>
                            </Box>
                            <Typography variant="h4" fontWeight="bold" color={(dashboard?.attendance_percentage || 0) >= 75 ? 'success.main' : 'error.main'}>
                                {dashboard?.attendance_percentage?.toFixed(0) || 0}%
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={dashboard?.attendance_percentage || 0}
                                color={(dashboard?.attendance_percentage || 0) >= 75 ? 'success' : 'error'}
                                sx={{ mt: 1, height: 6, borderRadius: 3 }}
                            />
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
                            <Typography variant="h4" fontWeight="bold" color={(dashboard?.pending_fees || 0) > 0 ? 'error.main' : 'success.main'}>
                                {formatCurrency(dashboard?.pending_fees || 0)}
                            </Typography>
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
                            <Typography variant="h4" fontWeight="bold">
                                {dashboard?.recent_grades?.length || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CertificateIcon color="success" />
                                <Typography color="text.secondary">Certificates</Typography>
                            </Box>
                            <Typography variant="h4" fontWeight="bold">
                                {certificates?.length || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tabs for detailed data */}
            <Paper>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab icon={<GradeIcon />} label="My Grades" />
                    <Tab icon={<PaymentIcon />} label="My Fees" />
                    <Tab icon={<CertificateIcon />} label="Certificates" />
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
                                        <TableCell>Date</TableCell>
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
                                            <TableCell>{g.exam_date ? new Date(g.exam_date).toLocaleDateString() : '-'}</TableCell>
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
                    {feesLoading ? (
                        <CircularProgress />
                    ) : fees?.length === 0 ? (
                        <Alert severity="info">No fee records available.</Alert>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell>Fee Type</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                        <TableCell align="right">Paid</TableCell>
                                        <TableCell align="right">Balance</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {fees?.map((fee) => (
                                        <TableRow key={fee.id} hover>
                                            <TableCell sx={{ textTransform: 'capitalize' }}>
                                                {fee.fee_type.replace('_', ' ')}
                                            </TableCell>
                                            <TableCell align="right">{formatCurrency(fee.total_amount)}</TableCell>
                                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                {formatCurrency(fee.paid_amount)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ color: fee.balance > 0 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                                                {formatCurrency(fee.balance)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={fee.status}
                                                    size="small"
                                                    color={
                                                        fee.status === 'completed' ? 'success' :
                                                            fee.status === 'overdue' ? 'error' : 'warning'
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {fee.status !== 'completed' && fee.status !== 'cancelled' && fee.balance > 0 && (
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={() => handlePayFee(fee)}
                                                    >
                                                        Pay Now
                                                    </Button>
                                                )}
                                                {fee.status === 'completed' && (
                                                    <Chip icon={<CheckIcon />} label="Paid" color="success" size="small" />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {certsLoading ? (
                        <CircularProgress />
                    ) : certificates?.length === 0 ? (
                        <Alert severity="info">No certificates available.</Alert>
                    ) : (
                        <Grid container spacing={2}>
                            {certificates?.map((cert) => (
                                <Grid item xs={12} sm={6} md={4} key={cert.id}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Box>
                                                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                                                        {cert.certificate_type.replace('_', ' ')}
                                                    </Typography>
                                                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                                                        {cert.certificate_number}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label={cert.status}
                                                    size="small"
                                                    color={cert.status === 'issued' ? 'success' : 'warning'}
                                                />
                                            </Box>
                                            {cert.issue_date && (
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                    Issued: {new Date(cert.issue_date).toLocaleDateString()}
                                                </Typography>
                                            )}
                                            <Button
                                                size="small"
                                                startIcon={<DownloadIcon />}
                                                sx={{ mt: 2 }}
                                                disabled={cert.status !== 'issued'}
                                            >
                                                Download
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={3}>
                    {timetableLoading ? (
                        <CircularProgress />
                    ) : !timetable?.length ? (
                        <Alert severity="info">
                            Your class timetable will be displayed here once configured.
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
                                            <TableCell sx={{ fontWeight: 'bold' }}>{slot.course || '-'}</TableCell>
                                            <TableCell>{slot.teacher || '-'}</TableCell>
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
            {selectedFee && (
                <PaymentCheckout
                    open={paymentOpen}
                    onClose={() => { setPaymentOpen(false); setSelectedFee(null); }}
                    amount={selectedFee.balance}
                    purpose="fee_payment"
                    description={`${selectedFee.fee_type.replace('_', ' ')} Payment`}
                    feePaymentId={selectedFee.id}
                    payerName={profile?.full_name || ''}
                    payerEmail={profile?.email || ''}
                    payerPhone={profile?.phone || ''}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </Box>
    );
};

export default StudentDashboard;
