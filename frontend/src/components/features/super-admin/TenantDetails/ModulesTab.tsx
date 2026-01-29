import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    Button,
    Alert,
    Switch,
    Card,
    CardContent,
    Stack,
    Chip
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Block as BlockIcon
} from '@mui/icons-material';
import { TenantDetail, useUpdateTenantMutation } from '@/store/api/superAdminApi';

const AVAILABLE_MODULES = [
    { key: 'students', name: 'Students', description: 'Student enrollment and management' },
    { key: 'courses', name: 'Courses', description: 'Course catalog and curriculum' },
    { key: 'attendance', name: 'Attendance', description: 'Student and staff attendance tracking' },
    { key: 'staff', name: 'Staff', description: 'Staff and faculty management' },
    { key: 'fees', name: 'Fees & Finance', description: 'Fee collection and financial management' },
    { key: 'calendar', name: 'Calendar', description: 'Academic calendar and events' },
    { key: 'reports', name: 'Reports', description: 'Analytics and reporting' },
    { key: 'communication', name: 'Communication', description: 'Messaging and notifications' }
];


interface ModulesTabProps {
    tenant: TenantDetail;
    refetch: () => void;
}

const ModulesTab: React.FC<ModulesTabProps> = ({ tenant, refetch }) => {
    const [updateTenant, { isLoading }] = useUpdateTenantMutation();
    const [restrictedModules, setRestrictedModules] = useState<string[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        setRestrictedModules(tenant.restricted_modules || []);
    }, [tenant]);

    const handleSubmit = async () => {
        try {
            setMessage(null);
            await updateTenant({
                id: tenant.id,
                data: { restricted_modules: restrictedModules }
            }).unwrap();
            setMessage({ type: 'success', text: 'Module access updated successfully' });
            refetch();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.data?.detail || "Failed to update modules" });
        }
    };

    const handleToggle = (moduleKey: string) => {
        setRestrictedModules(prev =>
            prev.includes(moduleKey)
                ? prev.filter(m => m !== moduleKey)
                : [...prev, moduleKey]
        );
    };

    const isActive = (moduleKey: string) => !restrictedModules.includes(moduleKey);

    const activeCount = AVAILABLE_MODULES.filter(m => isActive(m.key)).length;
    const restrictedCount = restrictedModules.length;

    return (
        <Box maxWidth="lg">
            <Paper variant="outlined" sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Module Access Control</Typography>
                    <Stack direction="row" spacing={2}>
                        <Chip
                            icon={<CheckCircleIcon />}
                            label={`${activeCount} Active`}
                            color="success"
                            variant="outlined"
                        />
                        <Chip
                            icon={<BlockIcon />}
                            label={`${restrictedCount} Restricted`}
                            color="error"
                            variant="outlined"
                        />
                    </Stack>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Toggle modules ON (green) to enable access, or OFF (red) to restrict access for this university.
                </Typography>

                {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

                <Grid container spacing={2}>
                    {AVAILABLE_MODULES.map((module) => {
                        const active = isActive(module.key);
                        return (
                            <Grid item xs={12} sm={6} md={4} key={module.key}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        borderColor: active ? 'success.main' : 'error.main',
                                        borderWidth: 2,
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            boxShadow: 2
                                        }
                                    }}
                                >
                                    <CardContent sx={{ pb: '16px !important' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="subtitle1" fontWeight={600}>
                                                {module.name}
                                            </Typography>
                                            <Switch
                                                checked={active}
                                                onChange={() => handleToggle(module.key)}
                                                color={active ? 'success' : 'default'}
                                            />
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                            {module.description}
                                        </Typography>
                                        <Chip
                                            size="small"
                                            icon={active ? <CheckCircleIcon /> : <BlockIcon />}
                                            label={active ? 'Active' : 'Restricted'}
                                            color={active ? 'success' : 'error'}
                                            variant="filled"
                                        />
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => setRestrictedModules([])}
                        disabled={isLoading}
                    >
                        Enable All Modules
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default ModulesTab;

