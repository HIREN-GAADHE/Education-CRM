import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Paper,
    Typography,
    Alert,
    Switch,
    Box,
    Stack,
    Chip
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Block as BlockIcon
} from '@mui/icons-material';
import { useUpdateTenantMutation } from '@/store/api/superAdminApi';

const AVAILABLE_MODULES = [
    { key: 'students', name: 'Students' },
    { key: 'courses', name: 'Courses' },
    { key: 'attendance', name: 'Attendance' },
    { key: 'staff', name: 'Staff' },
    { key: 'fees', name: 'Fees & Finance' },
    { key: 'calendar', name: 'Calendar' },
    { key: 'reports', name: 'Reports' },
    { key: 'communication', name: 'Communication' }
];


interface ModuleAccessDialogProps {
    open: boolean;
    onClose: () => void;
    tenant: { id: string; restricted_modules?: string[] } | null;
    onSuccess: () => void;
}

const ModuleAccessDialog: React.FC<ModuleAccessDialogProps> = ({ open, onClose, tenant, onSuccess }) => {
    const [updateTenant] = useUpdateTenantMutation();
    const [restrictedModules, setRestrictedModules] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && tenant) {
            setRestrictedModules(tenant.restricted_modules || []);
            setError(null);
        }
    }, [open, tenant]);

    const handleSubmit = async () => {
        if (!tenant) return;
        try {
            setError(null);
            await updateTenant({
                id: tenant.id,
                data: { restricted_modules: restrictedModules }
            }).unwrap();
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.data?.detail || "Failed to update modules");
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
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Manage Module Access</span>
                    <Stack direction="row" spacing={1}>
                        <Chip
                            size="small"
                            icon={<CheckCircleIcon />}
                            label={`${activeCount} Active`}
                            color="success"
                            variant="outlined"
                        />
                        <Chip
                            size="small"
                            icon={<BlockIcon />}
                            label={`${restrictedCount} Blocked`}
                            color="error"
                            variant="outlined"
                        />
                    </Stack>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Toggle OFF to restrict a module for this university. Restricted modules will be hidden from all users.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={1}>
                        {AVAILABLE_MODULES.map((module) => {
                            const active = isActive(module.key);
                            return (
                                <Grid item xs={12} key={module.key}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            py: 1,
                                            px: 1.5,
                                            borderRadius: 1,
                                            bgcolor: active ? 'success.50' : 'error.50',
                                            border: 1,
                                            borderColor: active ? 'success.200' : 'error.200'
                                        }}
                                    >
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            {active ? (
                                                <CheckCircleIcon color="success" fontSize="small" />
                                            ) : (
                                                <BlockIcon color="error" fontSize="small" />
                                            )}
                                            <Typography variant="body1" fontWeight={500}>
                                                {module.name}
                                            </Typography>
                                        </Stack>
                                        <Switch
                                            checked={active}
                                            onChange={() => handleToggle(module.key)}
                                            color="success"
                                        />
                                    </Box>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Paper>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit}>Save Changes</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ModuleAccessDialog;

