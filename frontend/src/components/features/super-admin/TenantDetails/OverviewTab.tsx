import React from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    Divider,
    Chip,
    Stack
} from '@mui/material';
import {
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
    School as SchoolIcon,
    CheckCircle as CheckCircleIcon,
    Block as BlockIcon
} from '@mui/icons-material';
import { TenantDetail } from '@/store/api/superAdminApi';

// All available modules in the system (matching actual project modules)
const ALL_MODULES = ['students', 'courses', 'attendance', 'staff', 'fees', 'calendar', 'reports', 'communication'];


interface OverviewTabProps {
    tenant: TenantDetail;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ tenant }) => {
    const restrictedModules = tenant.restricted_modules || [];
    const activeModules = ALL_MODULES.filter(m => !restrictedModules.includes(m));

    const formatModuleName = (module: string) => module.charAt(0).toUpperCase() + module.slice(1);

    return (
        <Box sx={{ p: 0 }}>
            <Grid container spacing={3}>
                {/* Basic Info Card */}
                <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Institution Details</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <BusinessIcon color="action" />
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Name</Typography>
                                        <Typography variant="body1">{tenant.name}</Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <SchoolIcon color="action" />
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Slug</Typography>
                                        <Chip label={tenant.slug} size="small" variant="outlined" />
                                    </Box>
                                </Stack>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <EmailIcon color="action" />
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Email</Typography>
                                        <Typography variant="body1">{tenant.email}</Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <PhoneIcon color="action" />
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Phone</Typography>
                                        <Typography variant="body1">{tenant.phone || 'N/A'}</Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                            <Grid item xs={12}>
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                    <LocationIcon color="action" sx={{ mt: 0.5 }} />
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Address</Typography>
                                        <Typography variant="body1">
                                            {[tenant.address, tenant.city, tenant.country].filter(Boolean).join(', ') || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* Stats Card */}
                <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Quick Stats</Typography>
                        <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body1">Total Users</Typography>
                                <Typography variant="h6" fontWeight="bold">{tenant.total_users}</Typography>
                            </Box>
                            <Divider />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body1">Staff Members</Typography>
                                <Typography variant="h6" fontWeight="bold">{tenant.total_staff || 0}</Typography>
                            </Box>
                            <Divider />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body1">Students</Typography>
                                <Typography variant="h6" fontWeight="bold">{tenant.total_students || 0}</Typography>
                            </Box>
                            <Divider />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body1">Plan</Typography>
                                <Chip label={tenant.plan_id || 'Free'} color="primary" size="small" />
                            </Box>
                            <Divider />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body1">Joined On</Typography>
                                <Typography variant="body2">{new Date(tenant.created_at).toLocaleDateString()}</Typography>
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Module Access Card */}
                <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Module Access</Typography>

                        {/* Active Modules */}
                        <Box sx={{ mb: 3 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                                <CheckCircleIcon color="success" fontSize="small" />
                                <Typography variant="subtitle2" color="success.main">
                                    Active Modules ({activeModules.length})
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {activeModules.length > 0 ? (
                                    activeModules.map(module => (
                                        <Chip
                                            key={module}
                                            label={formatModuleName(module)}
                                            color="success"
                                            variant="outlined"
                                            size="small"
                                            icon={<CheckCircleIcon />}
                                        />
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No active modules</Typography>
                                )}
                            </Stack>
                        </Box>

                        {/* Restricted Modules */}
                        <Box>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                                <BlockIcon color="error" fontSize="small" />
                                <Typography variant="subtitle2" color="error.main">
                                    Restricted Modules ({restrictedModules.length})
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {restrictedModules.length > 0 ? (
                                    restrictedModules.map(module => (
                                        <Chip
                                            key={module}
                                            label={formatModuleName(module)}
                                            color="error"
                                            variant="outlined"
                                            size="small"
                                            icon={<BlockIcon />}
                                        />
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No restrictions - Full access to all modules</Typography>
                                )}
                            </Stack>
                        </Box>

                        {/* Core admin modules note */}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                            <strong>Note:</strong> Users and Roles & Access modules are always available to university admins and cannot be restricted.
                        </Typography>
                    </Paper>
                </Grid>

            </Grid>
        </Box>
    );
};

export default OverviewTab;

