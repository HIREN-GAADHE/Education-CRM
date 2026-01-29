import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    CircularProgress,
    IconButton
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useGetTenantQuery } from '@/store/api/superAdminApi';
import OverviewTab from '../components/features/super-admin/TenantDetails/OverviewTab';
import SettingsTab from '../components/features/super-admin/TenantDetails/SettingsTab';
import ModulesTab from '../components/features/super-admin/TenantDetails/ModulesTab';

const TenantDetailsPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: tenant, isLoading, error, refetch } = useGetTenantQuery(id || '');
    const [tabIndex, setTabIndex] = useState(0);

    if (isLoading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
    if (error || !tenant) return <Box sx={{ p: 5 }}>Error loading university details</Box>;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={() => navigate('/tenants')} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" fontWeight="bold">
                    {tenant.name}
                </Typography>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
                    <Tab label="Overview" />
                    <Tab label="Settings" />
                    <Tab label="Module Access" />
                </Tabs>
            </Box>

            {tabIndex === 0 && <OverviewTab tenant={tenant} />}
            {tabIndex === 1 && <SettingsTab tenant={tenant} refetch={refetch} />}
            {tabIndex === 2 && <ModulesTab tenant={tenant} refetch={refetch} />}
        </Box>
    );
};

export default TenantDetailsPage;
