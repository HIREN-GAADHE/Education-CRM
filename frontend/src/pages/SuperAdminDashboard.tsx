import React, { useState, useMemo } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Button,
    CircularProgress,
    TextField,
    MenuItem,
    InputAdornment,
    Alert
} from '@mui/material';
import {
    Business as BusinessIcon,
    People as PeopleIcon,
    Add as AddIcon,
    TrendingUp as TrendingUpIcon,
    School as SchoolIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    useGetGlobalStatsQuery,
    useGetTenantsQuery,
    useUpdateTenantMutation,
    TenantStats
} from '@/store/api/superAdminApi';

// Sub-components
import TenantTable from '../components/features/super-admin/TenantTable';
import CreateTenantDialog from '../components/features/super-admin/dialogs/CreateTenantDialog';
import ManageAdminDialog from '../components/features/super-admin/dialogs/ManageAdminDialog';
import DeleteConfirmDialog from '../components/features/super-admin/dialogs/DeleteConfirmDialog';
import ModuleAccessDialog from '../components/features/super-admin/dialogs/ModuleAccessDialog';

const SuperAdminDashboard: React.FC = () => {
    const { data: globalStats, isLoading: statsLoading } = useGetGlobalStatsQuery();
    const { data: tenants, isLoading: tenantsLoading, refetch: refetchTenants } = useGetTenantsQuery();
    const [updateTenant] = useUpdateTenantMutation();

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Dialog States
    const [openTenantDialog, setOpenTenantDialog] = useState(false);
    const [openAdminDialog, setOpenAdminDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openModuleDialog, setOpenModuleDialog] = useState(false);

    // Selected Tenant for actions
    const [selectedTenant, setSelectedTenant] = useState<TenantStats | null>(null);

    // Filter Logic
    const filteredTenants = useMemo(() => {
        if (!tenants) return [];
        return tenants.filter(tenant => {
            const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tenant.slug.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [tenants, searchQuery, statusFilter]);

    // Handlers
    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleToggleStatus = async (tenant: TenantStats) => {
        try {
            const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
            await updateTenant({
                id: tenant.id,
                data: { status: newStatus }
            }).unwrap();
            refetchTenants();
            showSuccess(`University ${newStatus === 'active' ? 'activated' : 'suspended'}`);
        } catch (err: any) {
            console.error("Failed to toggle status", err);
            // Optionally set error state here
        }
    };

    if (statsLoading || tenantsLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" fontWeight="bold">Super Admin Dashboard</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenTenantDialog(true)}
                >
                    Add University
                </Button>
            </Box>

            {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

            {/* Global Stats */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="overline">Total Universities</Typography>
                                    <Typography variant="h4" fontWeight="bold">{globalStats?.total_tenants || 0}</Typography>
                                </Box>
                                <BusinessIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="overline">Active Universities</Typography>
                                    <Typography variant="h4" fontWeight="bold">{globalStats?.active_tenants || 0}</Typography>
                                </Box>
                                <SchoolIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="overline">Total Users</Typography>
                                    <Typography variant="h4" fontWeight="bold">{globalStats?.total_users_platform?.toLocaleString() || 0}</Typography>
                                </Box>
                                <PeopleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="overline">Total Revenue</Typography>
                                    <Typography variant="h4" fontWeight="bold">₹0</Typography>
                                </Box>
                                <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                <TextField
                    placeholder="Search universities..."
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
                    }}
                    sx={{ width: 300 }}
                />
                <TextField
                    select
                    size="small"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    sx={{ width: 150 }}
                >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                </TextField>
            </Box>

            {/* Tenant Table */}
            <TenantTable
                tenants={filteredTenants}
                onManageAdmin={(t) => { setSelectedTenant(t); setOpenAdminDialog(true); }}
                onManageModules={(t) => { setSelectedTenant(t); setOpenModuleDialog(true); }}
                onDelete={(t) => { setSelectedTenant(t); setOpenDeleteDialog(true); }}
                onToggleStatus={handleToggleStatus}
            />

            {/* Dialogs */}
            <CreateTenantDialog
                open={openTenantDialog}
                onClose={() => setOpenTenantDialog(false)}
                onSuccess={() => { refetchTenants(); showSuccess('University created successfully'); }}
            />

            <ManageAdminDialog
                open={openAdminDialog}
                onClose={() => setOpenAdminDialog(false)}
                tenantId={selectedTenant?.id || null}
                onSuccess={() => showSuccess('Admin credentials updated')}
            />

            <DeleteConfirmDialog
                open={openDeleteDialog}
                onClose={() => setOpenDeleteDialog(false)}
                tenant={selectedTenant ? { id: selectedTenant.id, name: selectedTenant.name } : null}
                onSuccess={() => { refetchTenants(); showSuccess('University deleted successfully'); }}
            />

            <ModuleAccessDialog
                open={openModuleDialog}
                onClose={() => setOpenModuleDialog(false)}
                tenant={selectedTenant ? { id: selectedTenant.id, restricted_modules: selectedTenant.restricted_modules } : null}
                onSuccess={() => { refetchTenants(); showSuccess('Module access updated'); }}
            />

        </Box>
    );
};

export default SuperAdminDashboard;
