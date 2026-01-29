import React from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Paper,
    CircularProgress,
    Divider
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    People as PeopleIcon,
    Business as BusinessIcon,
    Storage as StorageIcon
} from '@mui/icons-material';
import { useGetGlobalStatsQuery, useGetTenantsQuery } from '@/store/api/superAdminApi';

const SuperAdminStatsPage: React.FC = () => {
    const { data: globalStats, isLoading: statsLoading } = useGetGlobalStatsQuery();
    const { data: tenants, isLoading: tenantsLoading } = useGetTenantsQuery();

    if (statsLoading || tenantsLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    }

    // Calculate some derived stats
    const activeTenants = tenants?.filter((t: { status: string }) => t.status === 'active').length || 0;
    const suspendedTenants = tenants?.filter((t: { status: string }) => t.status === 'suspended').length || 0;
    const totalUsers = globalStats?.total_users_platform || 0;

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 4 }}>Platform Analytics</Typography>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline">Total Universities</Typography>
                                    <Typography variant="h3" fontWeight="bold">{globalStats?.total_tenants || 0}</Typography>
                                </Box>
                                <BusinessIcon sx={{ fontSize: 48, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline">Active Universities</Typography>
                                    <Typography variant="h3" fontWeight="bold">{activeTenants}</Typography>
                                </Box>
                                <TrendingUpIcon sx={{ fontSize: 48, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline">Platform Users</Typography>
                                    <Typography variant="h3" fontWeight="bold">{totalUsers.toLocaleString()}</Typography>
                                </Box>
                                <PeopleIcon sx={{ fontSize: 48, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline">Suspended</Typography>
                                    <Typography variant="h3" fontWeight="bold">{suspendedTenants}</Typography>
                                </Box>
                                <StorageIcon sx={{ fontSize: 48, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tenant Breakdown */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>University Breakdown</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                    {tenants?.slice(0, 10).map((tenant: { id: string; name: string; total_users: number; status: string }) => (
                        <Grid item xs={12} sm={6} md={4} key={tenant.id}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography fontWeight="bold">{tenant.name}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {tenant.total_users} users • Status: {tenant.status}
                                </Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Paper>
        </Box>
    );
};

export default SuperAdminStatsPage;
