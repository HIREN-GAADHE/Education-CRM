import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Avatar,
    LinearProgress,
    Chip,
    useTheme,
    Alert,
    Skeleton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    Button,
    IconButton,
    Stack,
} from '@mui/material';
import {
    People as PeopleIcon,
    School as SchoolIcon,
    MenuBook as CoursesIcon,
    AttachMoney as MoneyIcon,
    CalendarToday as CalendarIcon,
    Notifications as NotifIcon,
    AccessTime as TimeIcon,
    TrendingUp as TrendingUpIcon,
    Person as PersonIcon,
    Payment as PaymentIcon,
    Add as AddIcon,
    Email as EmailIcon,
    Assessment as AssessmentIcon,
    EventNote as EventNoteIcon,
    ArrowForward as ArrowForwardIcon,
    MoreHoriz as MoreIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import { selectUser } from '@/store/slices/authSlice';
import { useGetDashboardDataQuery } from '@/store/api/dashboardApi';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    change?: string;
    changeType?: 'positive' | 'negative';
    loading?: boolean;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    color,
    change,
    changeType,
    loading,
    onClick,
}) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Card
            sx={{
                height: '100%',
                cursor: onClick ? 'pointer' : 'default',
                '&:hover': onClick ? { transform: 'translateY(-2px)' } : {},
            }}
            onClick={onClick}
        >
            <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography
                            color="text.secondary"
                            variant="body2"
                            fontWeight={500}
                            sx={{ mb: 0.5 }}
                        >
                            {title}
                        </Typography>
                        {loading ? (
                            <Skeleton variant="text" width={80} height={40} />
                        ) : (
                            <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                                {value}
                            </Typography>
                        )}
                        {change && !loading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TrendingUpIcon
                                    sx={{
                                        fontSize: 14,
                                        color: changeType === 'positive' ? 'success.main' : 'error.main',
                                        transform: changeType === 'negative' ? 'rotate(180deg)' : 'none',
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: changeType === 'positive' ? 'success.main' : 'error.main',
                                        fontWeight: 600,
                                    }}
                                >
                                    {change}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                    <Avatar
                        sx={{
                            width: 48,
                            height: 48,
                            backgroundColor: isDark ? `${color}25` : `${color}15`,
                            color: color,
                        }}
                    >
                        {React.cloneElement(icon as React.ReactElement, {
                            sx: { fontSize: 24 },
                        })}
                    </Avatar>
                </Box>
            </CardContent>
        </Card>
    );
};

interface QuickActionProps {
    icon: React.ReactNode;
    label: string;
    color: string;
    onClick: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, onClick }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                backgroundColor: isDark ? `${color}15` : `${color}08`,
                border: '1px solid',
                borderColor: isDark ? `${color}30` : `${color}20`,
                transition: 'all 0.15s ease',
                '&:hover': {
                    backgroundColor: isDark ? `${color}25` : `${color}15`,
                    transform: 'translateY(-2px)',
                },
            }}
        >
            <Avatar sx={{ bgcolor: color, width: 40, height: 40 }}>
                {icon}
            </Avatar>
            <Typography variant="caption" fontWeight={600} textAlign="center">
                {label}
            </Typography>
        </Box>
    );
};

const DashboardPage: React.FC = () => {
    const user = useSelector(selectUser);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const navigate = useNavigate();

    const { data: dashboardData, isLoading, error } = useGetDashboardDataQuery();

    const formatCurrency = (amount: number) => {
        if (amount >= 100000) {
            return `₹${(amount / 100000).toFixed(1)}L`;
        }
        if (amount >= 1000) {
            return `₹${(amount / 1000).toFixed(1)}K`;
        }
        return `₹${amount.toFixed(0)}`;
    };

    const stats = dashboardData ? [
        {
            title: 'Total Students',
            value: dashboardData.stats.total_students.toLocaleString(),
            icon: <SchoolIcon />,
            color: '#4f46e5',
            change: dashboardData.stats.students_change || undefined,
            changeType: 'positive' as const,
            onClick: () => navigate('/students'),
        },
        {
            title: 'Total Staff',
            value: dashboardData.stats.total_staff.toLocaleString(),
            icon: <PeopleIcon />,
            color: '#0891b2',
            change: dashboardData.stats.staff_change || undefined,
            changeType: 'positive' as const,
            onClick: () => navigate('/staff'),
        },
        {
            title: 'Active Courses',
            value: dashboardData.stats.active_courses.toLocaleString(),
            icon: <CoursesIcon />,
            color: '#059669',
            change: dashboardData.stats.courses_change || undefined,
            changeType: 'positive' as const,
            onClick: () => navigate('/courses'),
        },
        {
            title: 'Fee Collection',
            value: formatCurrency(dashboardData.stats.fee_collection),
            icon: <MoneyIcon />,
            color: '#d97706',
            change: dashboardData.stats.fee_change || undefined,
            changeType: 'positive' as const,
            onClick: () => navigate('/fees'),
        },
    ] : [
        { title: 'Total Students', value: '0', icon: <SchoolIcon />, color: '#4f46e5' },
        { title: 'Total Staff', value: '0', icon: <PeopleIcon />, color: '#0891b2' },
        { title: 'Active Courses', value: '0', icon: <CoursesIcon />, color: '#059669' },
        { title: 'Fee Collection', value: '₹0', icon: <MoneyIcon />, color: '#d97706' },
    ];

    const schedule = dashboardData?.schedule || [];
    const notifications = dashboardData?.notifications || [];
    const attendance = dashboardData?.attendance || [];
    const recentStudents = dashboardData?.recent_students || [];
    const recentPayments = dashboardData?.recent_payments || [];

    const quickActions = [
        { icon: <AddIcon />, label: 'Add Student', color: '#4f46e5', path: '/students' },
        { icon: <PaymentIcon />, label: 'Record Fee', color: '#059669', path: '/fees' },
        { icon: <EmailIcon />, label: 'Send Message', color: '#0891b2', path: '/communication' },
        { icon: <AssessmentIcon />, label: 'Generate Report', color: '#d97706', path: '/reports' },
        { icon: <EventNoteIcon />, label: 'Add Event', color: '#dc2626', path: '/calendar' },
        { icon: <PersonIcon />, label: 'Add Staff', color: '#7c3aed', path: '/staff' },
    ];

    const currentDate = new Date();
    const timeOfDay = currentDate.getHours() < 12 ? 'morning' : currentDate.getHours() < 17 ? 'afternoon' : 'evening';

    return (
        <Box>
            {/* Welcome Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom color="text.primary">
                    Good {timeOfDay}, {user?.first_name || 'User'}! 👋
                </Typography>
                <Typography color="text.secondary">
                    Here's what's happening at your institution today, {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
                </Typography>
            </Box>

            {error && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Unable to load live data. Some features may be limited.
                </Alert>
            )}

            {/* Stats Grid */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {stats.map((stat) => (
                    <Grid item xs={12} sm={6} lg={3} key={stat.title}>
                        <StatCard {...stat} loading={isLoading} />
                    </Grid>
                ))}
            </Grid>

            {/* Quick Actions */}
            <Card sx={{ mb: 4 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Quick Actions
                    </Typography>
                    <Grid container spacing={2}>
                        {quickActions.map((action) => (
                            <Grid item xs={6} sm={4} md={2} key={action.label}>
                                <QuickAction
                                    {...action}
                                    onClick={() => navigate(action.path)}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>

            {/* Main Content */}
            <Grid container spacing={3}>
                {/* Today's Schedule */}
                <Grid item xs={12} lg={8}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            bgcolor: isDark ? 'rgba(79, 70, 229, 0.2)' : 'rgba(79, 70, 229, 0.1)',
                                            color: 'primary.main',
                                        }}
                                    >
                                        <CalendarIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" fontWeight="bold">
                                            Today's Schedule
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button
                                    size="small"
                                    endIcon={<ArrowForwardIcon />}
                                    onClick={() => navigate('/calendar')}
                                >
                                    View Calendar
                                </Button>
                            </Box>

                            {isLoading ? (
                                <Stack spacing={1.5}>
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} variant="rounded" height={60} />
                                    ))}
                                </Stack>
                            ) : (
                                <Stack spacing={1.5}>
                                    {schedule.length === 0 ? (
                                        <Box sx={{ py: 3, textAlign: 'center' }}>
                                            <CalendarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                            <Typography color="text.secondary">
                                                No events scheduled for today
                                            </Typography>
                                            <Button
                                                size="small"
                                                sx={{ mt: 1 }}
                                                onClick={() => navigate('/calendar')}
                                            >
                                                Add Event
                                            </Button>
                                        </Box>
                                    ) : (
                                        schedule.map((item, index) => (
                                            <Box
                                                key={index}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    p: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    transition: 'all 0.15s ease',
                                                    '&:hover': {
                                                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                                        borderColor: item.color,
                                                    },
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 4,
                                                        height: 40,
                                                        borderRadius: 1,
                                                        backgroundColor: item.color,
                                                        mr: 2,
                                                    }}
                                                />
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="body1" fontWeight={600}>
                                                        {item.event}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                                                        <TimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.time}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Chip
                                                    label={item.type}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: `${item.color}15`,
                                                        color: item.color,
                                                        fontWeight: 600,
                                                        textTransform: 'capitalize',
                                                        fontSize: '0.7rem',
                                                    }}
                                                />
                                            </Box>
                                        ))
                                    )}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Right Column */}
                <Grid item xs={12} lg={4}>
                    <Stack spacing={3}>
                        {/* Notifications */}
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Avatar
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                bgcolor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                color: 'error.main',
                                            }}
                                        >
                                            <NotifIcon fontSize="small" />
                                        </Avatar>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Notifications
                                        </Typography>
                                    </Box>
                                    <Chip label={`${notifications.length} new`} size="small" color="error" />
                                </Box>

                                {isLoading ? (
                                    <Stack spacing={1}>
                                        {[1, 2].map((i) => (
                                            <Skeleton key={i} variant="rounded" height={40} />
                                        ))}
                                    </Stack>
                                ) : (
                                    <Stack spacing={1}>
                                        {notifications.length === 0 ? (
                                            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                                No new notifications
                                            </Typography>
                                        ) : (
                                            notifications.slice(0, 3).map((notif, index) => (
                                                <Box
                                                    key={index}
                                                    sx={{
                                                        p: 1.5,
                                                        borderRadius: 1.5,
                                                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                                    }}
                                                >
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {notif.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {notif.time}
                                                    </Typography>
                                                </Box>
                                            ))
                                        )}
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>

                        {/* System Status */}
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    System Status
                                </Typography>
                                <Stack spacing={1.5}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                                        <Typography variant="body2">Database Connected</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                                        <Typography variant="body2">API Services Running</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                                        <Typography variant="body2">All Modules Active</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>

                {/* Recent Students & Payments Row */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            bgcolor: isDark ? 'rgba(79, 70, 229, 0.2)' : 'rgba(79, 70, 229, 0.1)',
                                            color: 'primary.main',
                                        }}
                                    >
                                        <PersonIcon fontSize="small" />
                                    </Avatar>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Recent Students
                                    </Typography>
                                </Box>
                                <Button size="small" onClick={() => navigate('/students')}>
                                    View All
                                </Button>
                            </Box>

                            {isLoading ? (
                                <Skeleton variant="rounded" height={180} />
                            ) : recentStudents.length === 0 ? (
                                <Box sx={{ py: 3, textAlign: 'center' }}>
                                    <SchoolIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                                    <Typography color="text.secondary">No students yet</Typography>
                                    <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/students')}>
                                        Add First Student
                                    </Button>
                                </Box>
                            ) : (
                                <List dense disablePadding>
                                    {recentStudents.slice(0, 4).map((student, index) => (
                                        <React.Fragment key={student.id}>
                                            <ListItem disableGutters>
                                                <ListItemAvatar>
                                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.875rem' }}>
                                                        {student.name[0]}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={student.name}
                                                    secondary={student.admission_number}
                                                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.875rem' }}
                                                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                                />
                                            </ListItem>
                                            {index < recentStudents.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            bgcolor: isDark ? 'rgba(217, 119, 6, 0.2)' : 'rgba(217, 119, 6, 0.1)',
                                            color: '#d97706',
                                        }}
                                    >
                                        <PaymentIcon fontSize="small" />
                                    </Avatar>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Recent Payments
                                    </Typography>
                                </Box>
                                <Button size="small" onClick={() => navigate('/fees')}>
                                    View All
                                </Button>
                            </Box>

                            {isLoading ? (
                                <Skeleton variant="rounded" height={180} />
                            ) : recentPayments.length === 0 ? (
                                <Box sx={{ py: 3, textAlign: 'center' }}>
                                    <PaymentIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                                    <Typography color="text.secondary">No payments yet</Typography>
                                    <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/fees')}>
                                        Record Payment
                                    </Button>
                                </Box>
                            ) : (
                                <List dense disablePadding>
                                    {recentPayments.slice(0, 4).map((payment, index) => (
                                        <React.Fragment key={payment.id}>
                                            <ListItem disableGutters>
                                                <ListItemAvatar>
                                                    <Avatar sx={{ bgcolor: '#059669', width: 32, height: 32, fontSize: '0.75rem' }}>
                                                        ₹
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={`₹${payment.amount.toLocaleString()}`}
                                                    secondary={payment.student_name}
                                                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem', color: '#059669' }}
                                                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                                />
                                            </ListItem>
                                            {index < recentPayments.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Attendance Overview */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold">
                                    Department Attendance
                                </Typography>
                                <Button size="small" onClick={() => navigate('/attendance')}>
                                    View Details
                                </Button>
                            </Box>
                            <Grid container spacing={2}>
                                {(isLoading ? [1, 2, 3, 4] : attendance).map((dept, index) => (
                                    <Grid item xs={12} sm={6} md={3} key={typeof dept === 'number' ? dept : dept.label}>
                                        {isLoading ? (
                                            <Skeleton variant="rounded" height={80} />
                                        ) : (
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: isDark ? `${(dept as any).color}15` : `${(dept as any).color}08`,
                                                    border: '1px solid',
                                                    borderColor: isDark ? `${(dept as any).color}30` : `${(dept as any).color}20`,
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {(dept as any).label}
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="bold" sx={{ color: (dept as any).color }}>
                                                        {(dept as any).value}%
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={(dept as any).value}
                                                    sx={{
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: isDark ? `${(dept as any).color}25` : `${(dept as any).color}20`,
                                                        '& .MuiLinearProgress-bar': {
                                                            borderRadius: 3,
                                                            backgroundColor: (dept as any).color,
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        )}
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardPage;
