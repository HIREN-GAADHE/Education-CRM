import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Box,
    Alert
} from '@mui/material';
import { useManageAdminMutation, TenantAdminAction } from '@/store/api/superAdminApi';

interface ManageAdminDialogProps {
    open: boolean;
    onClose: () => void;
    tenantId: string | null;
    onSuccess: () => void;
}

const ManageAdminDialog: React.FC<ManageAdminDialogProps> = ({ open, onClose, tenantId, onSuccess }) => {
    const [manageAdmin] = useManageAdminMutation();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [form, setForm] = useState<TenantAdminAction>({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        action: 'create'
    });

    useEffect(() => {
        if (!open) {
            setForm({ email: '', password: '', first_name: '', last_name: '', action: 'create' });
            setSubmitError(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!tenantId) return;
        try {
            setSubmitError(null);
            await manageAdmin({ tenantId, data: form }).unwrap();
            onSuccess();
            onClose();
        } catch (err: any) {
            setSubmitError(err.data?.detail || "Failed to update admin");
        }
    };

    const handleChange = (field: keyof TenantAdminAction, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Manage University Admin</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="First Name"
                                fullWidth
                                value={form.first_name}
                                onChange={(e) => handleChange('first_name', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Last Name"
                                fullWidth
                                value={form.last_name}
                                onChange={(e) => handleChange('last_name', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Admin Email"
                                fullWidth
                                value={form.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="New Password"
                                type="password"
                                fullWidth
                                value={form.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit}>Update Admin</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ManageAdminDialog;
