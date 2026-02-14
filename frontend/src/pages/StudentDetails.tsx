import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Avatar, Chip, Tabs, Tab, Grid, Card, CardContent,
    LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Divider, CircularProgress, Alert, List, ListItem, ListItemIcon,
    ListItemText, Tooltip, IconButton, Breadcrumbs, Link, Button
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    School as SchoolIcon,
    EventAvailable as AttendanceIcon,
    Assessment as ExamIcon,
    Payment as FeeIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Home as HomeIcon,
    CalendarMonth as CalendarIcon,
    TrendingUp as TrendingUpIcon,
    CheckCircle as PassIcon,
    Cancel as FailIcon,
    Print as PrintIcon,
    Download as DownloadIcon,
    Timeline as TimelineIcon,
    EmojiEvents as RankIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { useGetStudentProfileQuery } from '@/store/api/studentApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

// Download helper function
const downloadFile = async (url: string, filename: string, token: string | null, tenantId?: string) => {
    const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const fullUrl = `${apiBaseUrl}${url}`;

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(fullUrl, { headers });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
};

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

// Stat Card Component
const StatCard = ({ title, value, subtitle, color, icon }: { title: string; value: string | number; subtitle?: string; color: string; icon: React.ReactNode }) => (
    <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`, border: `1px solid ${color}30` }}>
        <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ color }}>{value}</Typography>
                    {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
                </Box>
                <Avatar sx={{ bgcolor: `${color}20`, color }}>{icon}</Avatar>
            </Box>
        </CardContent>
    </Card>
);

const StudentDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tabValue, setTabValue] = React.useState(0);
    const [downloading, setDownloading] = React.useState<string | null>(null);

    // Get auth token and tenant from Redux
    const token = useSelector((state: RootState) => state.auth.accessToken);
    const tenant = useSelector((state: RootState) => state.tenant.tenant);

    const { data: profile, isLoading, error } = useGetStudentProfileQuery(id || '', {
        skip: !id,
    });

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleDownloadIdCard = async () => {
        if (!id) return;
        setDownloading('id-card');
        try {
            await downloadFile(
                `/students/${id}/id-card`,
                `id_card_${profile?.student.admission_number || id}.pdf`,
                token,
                tenant?.id
            );
        } catch (err) {
            console.error('Failed to download ID card:', err);
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadTranscript = async () => {
        if (!id) return;
        setDownloading('transcript');
        try {
            await downloadFile(
                `/students/${id}/transcript`,
                `transcript_${profile?.student.admission_number || id}.pdf`,
                token,
                tenant?.id
            );
        } catch (err) {
            console.error('Failed to download transcript:', err);
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadReceipt = async (paymentId: string) => {
        setDownloading(`receipt-${paymentId}`);
        try {
            await downloadFile(
                `/fees/${paymentId}/receipt`,
                `receipt_${paymentId}.pdf`,
                token,
                tenant?.id
            );
        } catch (err) {
            console.error('Failed to download receipt:', err);
        } finally {
            setDownloading(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'graduated': return 'primary';
            case 'suspended': return 'error';
            case 'dropped': return 'error';
            case 'enrolled': return 'info';
            default: return 'default';
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !profile) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">Failed to load student profile. Please try again later.</Alert>
                <Button variant="outlined" onClick={() => navigate('/students')} sx={{ mt: 2 }}>
                    Return to Students List
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header / Breadcrumbs */}
            <Box sx={{ mb: 4 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ mb: 2 }}>
                    <Link underline="hover" color="inherit" onClick={() => navigate('/dashboard')} sx={{ cursor: 'pointer' }}>
                        Dashboard
                    </Link>
                    <Link underline="hover" color="inherit" onClick={() => navigate('/students')} sx={{ cursor: 'pointer' }}>
                        Students
                    </Link>
                    <Typography color="text.primary">{profile.student.full_name}</Typography>
                </Breadcrumbs>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <IconButton onClick={() => navigate('/students')} sx={{ mr: 2 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" fontWeight="bold">
                        Student Profile
                    </Typography>
                </Box>
            </Box>

            {/* Profile Header Card */}
            <Card sx={{
                mb: 4,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                overflow: 'visible'
            }}>
                <CardContent sx={{ position: 'relative', p: 4 }}>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexDirection: { xs: 'column', md: 'row' } }}>
                        <Avatar
                            src={profile.student.avatar_url || undefined}
                            sx={{
                                width: 120,
                                height: 120,
                                fontSize: 48,
                                bgcolor: 'rgba(255,255,255,0.2)',
                                border: '4px solid rgba(255,255,255,0.3)'
                            }}
                        >
                            {profile.student.first_name[0]}{profile.student.last_name[0]}
                        </Avatar>

                        <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
                            <Typography variant="h3" fontWeight="bold">{profile.student.full_name}</Typography>
                            <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                                {profile.student.admission_number} {profile.student.roll_number && `• Roll: ${profile.student.roll_number}`}
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                                <Chip
                                    label={profile.student.status}
                                    color={getStatusColor(profile.student.status) as any}
                                    sx={{ textTransform: 'capitalize', fontWeight: 'bold' }}
                                />
                                {profile.academic_progress.class && (
                                    <Chip
                                        label={`${profile.academic_progress.class.name}-${profile.academic_progress.class.section}`}
                                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                    />
                                )}
                                {profile.academic_progress.course && (
                                    <Chip
                                        label={profile.academic_progress.course}
                                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                    />
                                )}
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Download ID Card">
                                <IconButton
                                    sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                                    onClick={handleDownloadIdCard}
                                    disabled={downloading === 'id-card'}
                                >
                                    {downloading === 'id-card' ? <CircularProgress size={24} color="inherit" /> : <PrintIcon />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Download Transcript">
                                <IconButton
                                    sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                                    onClick={handleDownloadTranscript}
                                    disabled={downloading === 'transcript'}
                                >
                                    {downloading === 'transcript' ? <CircularProgress size={24} color="inherit" /> : <DownloadIcon />}
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Card>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}
                >
                    <Tab icon={<PersonIcon />} label="Overview" iconPosition="start" />
                    <Tab icon={<TimelineIcon />} label="Journey" iconPosition="start" />
                    <Tab icon={<AttendanceIcon />} label="Attendance" iconPosition="start" />
                    <Tab icon={<ExamIcon />} label="Exams" iconPosition="start" />
                    <Tab icon={<FeeIcon />} label="Fees" iconPosition="start" />
                </Tabs>

                <Box sx={{ p: 0 }}>
                    {/* Overview Tab */}
                    <TabPanel value={tabValue} index={0}>
                        <Box sx={{ px: 3 }}>
                            <Grid container spacing={3} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <StatCard
                                        title="Attendance"
                                        value={`${profile.attendance_summary.attendance_percentage}%`}
                                        subtitle={`${profile.attendance_summary.present}/${profile.attendance_summary.total_days} days`}
                                        color="#4caf50"
                                        icon={<AttendanceIcon />}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <StatCard
                                        title="Exams Passed"
                                        value={`${profile.exam_summary.exams_passed}/${profile.exam_summary.exams_taken}`}
                                        subtitle={`Avg: ${profile.exam_summary.average_percentage}%`}
                                        color="#2196f3"
                                        icon={<ExamIcon />}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <StatCard
                                        title="Fee Status"
                                        value={`${profile.fee_summary.payment_percentage}%`}
                                        subtitle={`₹${profile.fee_summary.pending.toLocaleString()} pending`}
                                        color={profile.fee_summary.pending > 0 ? '#ff9800' : '#4caf50'}
                                        icon={<FeeIcon />}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <StatCard
                                        title="Days Enrolled"
                                        value={profile.enrollment_journey.days_enrolled}
                                        subtitle={profile.enrollment_journey.batch || 'N/A'}
                                        color="#9c27b0"
                                        icon={<CalendarIcon />}
                                    />
                                </Grid>
                            </Grid>

                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <PersonIcon color="primary" /> Personal Information
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Date of Birth</Typography>
                                                    <Typography>{profile.student.date_of_birth || '-'}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Gender</Typography>
                                                    <Typography sx={{ textTransform: 'capitalize' }}>{profile.student.gender || '-'}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Blood Group</Typography>
                                                    <Typography>{profile.student.blood_group || '-'}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Nationality</Typography>
                                                    <Typography>{profile.student.nationality || '-'}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Category</Typography>
                                                    <Typography>{profile.student.category || '-'}</Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <PhoneIcon color="primary" /> Contact Information
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <List dense>
                                                <ListItem>
                                                    <ListItemIcon><EmailIcon /></ListItemIcon>
                                                    <ListItemText primary={profile.student.email || '-'} secondary="Email" />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemIcon><PhoneIcon /></ListItemIcon>
                                                    <ListItemText primary={profile.student.phone || '-'} secondary="Phone" />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemIcon><HomeIcon /></ListItemIcon>
                                                    <ListItemText
                                                        primary={[profile.student.address_line1, profile.student.city, profile.student.state].filter(Boolean).join(', ') || '-'}
                                                        secondary="Address"
                                                    />
                                                </ListItem>
                                            </List>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <HomeIcon color="primary" /> Family Information
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} md={4}>
                                                    <Typography variant="subtitle2" color="primary">Father</Typography>
                                                    <Typography variant="body2">{profile.student.father_name || '-'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{profile.student.father_phone}</Typography>
                                                </Grid>
                                                <Grid item xs={12} md={4}>
                                                    <Typography variant="subtitle2" color="primary">Mother</Typography>
                                                    <Typography variant="body2">{profile.student.mother_name || '-'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{profile.student.mother_phone}</Typography>
                                                </Grid>
                                                {profile.student.guardian_name && (
                                                    <Grid item xs={12} md={4}>
                                                        <Typography variant="subtitle2" color="primary">Guardian</Typography>
                                                        <Typography variant="body2">{profile.student.guardian_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{profile.student.guardian_phone}</Typography>
                                                    </Grid>
                                                )}
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    </TabPanel>

                    {/* Enrollment Journey Tab */}
                    <TabPanel value={tabValue} index={1}>
                        <Box sx={{ px: 3 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.50', borderRadius: 2, height: '100%' }}>
                                        <CalendarIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                                        <Typography variant="body2" color="text.secondary">Admission Date</Typography>
                                        <Typography variant="h6" fontWeight="bold" color="primary">
                                            {profile.enrollment_journey?.admission_date || 'Not Set'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2, height: '100%' }}>
                                        <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                                        <Typography variant="body2" color="text.secondary">Time Enrolled</Typography>
                                        <Typography variant="h6" fontWeight="bold" color="success.main">
                                            {(profile.enrollment_journey?.years_enrolled ?? 0) > 0
                                                ? `${profile.enrollment_journey.years_enrolled} Year${(profile.enrollment_journey.years_enrolled ?? 0) > 1 ? 's' : ''}`
                                                : (profile.enrollment_journey?.months_enrolled ?? 0) > 0
                                                    ? `${profile.enrollment_journey.months_enrolled} Month${(profile.enrollment_journey.months_enrolled ?? 0) > 1 ? 's' : ''}`
                                                    : profile.enrollment_journey?.days_enrolled
                                                        ? `${profile.enrollment_journey.days_enrolled} Days`
                                                        : 'Not Set'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.50', borderRadius: 2, height: '100%' }}>
                                        <SchoolIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                                        <Typography variant="body2" color="text.secondary">Current Semester</Typography>
                                        <Typography variant="h6" fontWeight="bold" color="info.main">
                                            {profile.enrollment_journey.current_semester || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2, height: '100%' }}>
                                        <RankIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                                        <Typography variant="body2" color="text.secondary">Expected Graduation</Typography>
                                        <Typography variant="h6" fontWeight="bold" color="warning.main">
                                            {profile.enrollment_journey.expected_graduation || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <SchoolIcon color="primary" /> Academic Information
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Course</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {profile.enrollment_journey.course || profile.student.course || '-'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Department</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {profile.enrollment_journey.department || profile.student.department || '-'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Class</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {profile.enrollment_journey.class_name || '-'} {profile.enrollment_journey.section ? `(${profile.enrollment_journey.section})` : ''}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Roll Number</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {profile.enrollment_journey.roll_number || '-'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Academic Year</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {profile.enrollment_journey.academic_year || '-'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Batch</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {profile.enrollment_journey.batch || '-'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Admission Type</Typography>
                                                    <Typography variant="body1" fontWeight="medium" sx={{ textTransform: 'capitalize' }}>
                                                        {profile.enrollment_journey.admission_type || 'Regular'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Current Status</Typography>
                                                    <Box>
                                                        <Chip
                                                            label={profile.enrollment_journey.current_status}
                                                            size="small"
                                                            color={getStatusColor(profile.enrollment_journey.current_status) as any}
                                                            sx={{ textTransform: 'capitalize' }}
                                                        />
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <TimelineIcon color="primary" /> Academic Milestones
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            {profile.enrollment_journey.milestones && profile.enrollment_journey.milestones.length > 0 ? (
                                                <Box sx={{ position: 'relative', pl: 3 }}>
                                                    {profile.enrollment_journey.milestones.map((milestone: any, index: number) => (
                                                        <Box
                                                            key={index}
                                                            sx={{
                                                                position: 'relative',
                                                                pb: 3,
                                                                '&::before': {
                                                                    content: '""',
                                                                    position: 'absolute',
                                                                    left: -20,
                                                                    top: 8,
                                                                    bottom: index === (profile.enrollment_journey.milestones?.length ?? 0) - 1 ? 'auto' : 0,
                                                                    width: 2,
                                                                    bgcolor: milestone.type === 'current' ? 'success.main' : 'grey.300'
                                                                }
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    position: 'absolute',
                                                                    left: -24,
                                                                    top: 4,
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: '50%',
                                                                    bgcolor: milestone.type === 'current' ? 'success.main' : milestone.type === 'admission' ? 'primary.main' : 'grey.400',
                                                                    border: '2px solid white',
                                                                    boxShadow: 1
                                                                }}
                                                            />
                                                            <Typography variant="body1" fontWeight="medium">{milestone.title}</Typography>
                                                            <Typography variant="caption" color="text.secondary">{milestone.date}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Typography color="text.secondary">No milestones recorded</Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12}>
                                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                                        <CardContent>
                                            <Grid container spacing={2} sx={{ textAlign: 'center', color: 'white' }}>
                                                <Grid item xs={3}>
                                                    <Typography variant="h4" fontWeight="bold">{profile.enrollment_journey?.days_enrolled ?? 0}</Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Days Enrolled</Typography>
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <Typography variant="h4" fontWeight="bold">{profile.attendance_summary?.attendance_percentage ?? 0}%</Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Attendance</Typography>
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <Typography variant="h4" fontWeight="bold">{profile.exam_summary?.total_exams ?? 0}</Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Exams Taken</Typography>
                                                </Grid>
                                                <Grid item xs={3}>
                                                    <Typography variant="h4" fontWeight="bold">{profile.exam_summary?.pass_percentage ?? 0}%</Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Pass Rate</Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    </TabPanel>

                    {/* Attendance Tab */}
                    <TabPanel value={tabValue} index={2}>
                        <Box sx={{ px: 3 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={8}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Attendance Summary</Typography>
                                            <Box sx={{ mb: 3 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography>Overall Attendance</Typography>
                                                    <Typography fontWeight="bold">{profile.attendance_summary.attendance_percentage}%</Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={profile.attendance_summary.attendance_percentage}
                                                    sx={{ height: 10, borderRadius: 5 }}
                                                    color={profile.attendance_summary.attendance_percentage >= 75 ? 'success' : 'warning'}
                                                />
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={4}>
                                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                                                        <Typography variant="h4" color="success.main" fontWeight="bold">{profile.attendance_summary.present}</Typography>
                                                        <Typography variant="body2">Present</Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={4}>
                                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 2 }}>
                                                        <Typography variant="h4" color="error.main" fontWeight="bold">{profile.attendance_summary.absent}</Typography>
                                                        <Typography variant="body2">Absent</Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={4}>
                                                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                                                        <Typography variant="h4" color="warning.main" fontWeight="bold">{profile.attendance_summary.late}</Typography>
                                                        <Typography variant="body2">Late</Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Additional Stats</Typography>
                                            <List dense>
                                                <ListItem>
                                                    <ListItemText primary="Half Days" />
                                                    <Chip label={profile.attendance_summary.half_day} size="small" />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemText primary="On Leave" />
                                                    <Chip label={profile.attendance_summary.on_leave} size="small" />
                                                </ListItem>
                                                <ListItem>
                                                    <ListItemText primary="Total Days" />
                                                    <Chip label={profile.attendance_summary.total_days} size="small" color="primary" />
                                                </ListItem>
                                            </List>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    </TabPanel>

                    {/* Exams Tab */}
                    <TabPanel value={tabValue} index={3}>
                        <Box sx={{ px: 3 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                        <CardContent>
                                            <Typography variant="h6">Exam Performance</Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h3" fontWeight="bold">{profile.exam_summary.exams_taken}</Typography>
                                                    <Typography variant="body2">Total Exams</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h3" fontWeight="bold">{profile.exam_summary.exams_passed}</Typography>
                                                    <Typography variant="body2">Passed</Typography>
                                                </Box>
                                            </Box>
                                            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h5" fontWeight="bold">{profile.exam_summary.average_percentage}%</Typography>
                                                    <Typography variant="body2">Avg. Percentage</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h5" fontWeight="bold">{profile.exam_summary.average_grade_point}</Typography>
                                                    <Typography variant="body2">CGPA</Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={8}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Recent Results</Typography>
                                            {profile.exam_summary.recent_results.length === 0 ? (
                                                <Typography color="text.secondary">No exam results yet</Typography>
                                            ) : (
                                                <TableContainer>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Exam</TableCell>
                                                                <TableCell>Subject</TableCell>
                                                                <TableCell>Marks</TableCell>
                                                                <TableCell>Grade</TableCell>
                                                                <TableCell>Rank</TableCell>
                                                                <TableCell>Status</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {profile.exam_summary.recent_results.map((result, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell>{result.exam_name}</TableCell>
                                                                    <TableCell>{result.subject}</TableCell>
                                                                    <TableCell>{result.marks_obtained}/{result.max_marks}</TableCell>
                                                                    <TableCell>
                                                                        <Chip label={result.grade || '-'} size="small" color="primary" variant="outlined" />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {result.rank && result.rank <= 3 ? (
                                                                            <Chip
                                                                                icon={<RankIcon />}
                                                                                label={`#${result.rank}`}
                                                                                size="small"
                                                                                color={result.rank === 1 ? 'warning' : 'default'}
                                                                            />
                                                                        ) : result.rank || '-'}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {result.is_passed ? (
                                                                            <Chip icon={<PassIcon />} label="Pass" size="small" color="success" />
                                                                        ) : (
                                                                            <Chip icon={<FailIcon />} label="Fail" size="small" color="error" />
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    </TabPanel>

                    {/* Fees Tab */}
                    <TabPanel value={tabValue} index={4}>
                        <Box sx={{ px: 3 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Fee Summary</Typography>
                                            <Box sx={{ mb: 3 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography>Payment Progress</Typography>
                                                    <Typography fontWeight="bold">{profile.fee_summary.payment_percentage}%</Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={profile.fee_summary.payment_percentage}
                                                    sx={{ height: 10, borderRadius: 5 }}
                                                    color={profile.fee_summary.payment_percentage >= 100 ? 'success' : 'warning'}
                                                />
                                            </Box>
                                            <Divider sx={{ my: 2 }} />
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary">Total Fees</Typography>
                                                    <Typography fontWeight="bold">₹{profile.fee_summary.total_fees.toLocaleString()}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="success.main">Paid</Typography>
                                                    <Typography fontWeight="bold" color="success.main">₹{profile.fee_summary.paid.toLocaleString()}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="error.main">Pending</Typography>
                                                    <Typography fontWeight="bold" color="error.main">₹{profile.fee_summary.pending.toLocaleString()}</Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={8}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>Recent Payments</Typography>
                                            {profile.fee_summary.recent_payments.length === 0 ? (
                                                <Typography color="text.secondary">No payment records yet</Typography>
                                            ) : (
                                                <TableContainer>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Fee Type</TableCell>
                                                                <TableCell>Total</TableCell>
                                                                <TableCell>Paid</TableCell>
                                                                <TableCell>Due Date</TableCell>
                                                                <TableCell>Status</TableCell>
                                                                <TableCell>Actions</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {profile.fee_summary.recent_payments.map((payment) => (
                                                                <TableRow key={payment.id}>
                                                                    <TableCell sx={{ textTransform: 'capitalize' }}>{payment.fee_type}</TableCell>
                                                                    <TableCell>₹{payment.total_amount.toLocaleString()}</TableCell>
                                                                    <TableCell>₹{payment.amount_paid.toLocaleString()}</TableCell>
                                                                    <TableCell>{payment.due_date || '-'}</TableCell>
                                                                    <TableCell>
                                                                        <Chip
                                                                            label={payment.status}
                                                                            size="small"
                                                                            color={payment.status === 'paid' ? 'success' : payment.status === 'overdue' ? 'error' : 'warning'}
                                                                            sx={{ textTransform: 'capitalize' }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Tooltip title="Download Receipt">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => handleDownloadReceipt(payment.id)}
                                                                                disabled={downloading === `receipt-${payment.id}`}
                                                                            >
                                                                                {downloading === `receipt-${payment.id}` ? (
                                                                                    <CircularProgress size={16} />
                                                                                ) : (
                                                                                    <DownloadIcon fontSize="small" />
                                                                                )}
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    </TabPanel>
                </Box>
            </Card>
        </Box>
    );
};

export default StudentDetailsPage;
