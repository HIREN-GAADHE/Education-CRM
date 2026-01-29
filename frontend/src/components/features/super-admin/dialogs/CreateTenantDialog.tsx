import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Box,
    Typography,
    Alert
} from '@mui/material';
import { useCreateTenantMutation, CreateTenantRequest } from '@/store/api/superAdminApi';

interface CreateTenantDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateTenantDialog: React.FC<CreateTenantDialogProps> = ({ open, onClose, onSuccess }) => {
    const [createTenant] = useCreateTenantMutation();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [form, setForm] = useState<CreateTenantRequest>({
        name: '',
        slug: '',
        domain: '',
        email: '',
        admin_email: '',
        admin_password: '',
        admin_first_name: '',
        admin_last_name: '',
        country: 'India'
    });

    const handleSubmit = async () => {
        try {
            setSubmitError(null);
            await createTenant(form).unwrap();
            // Reset form
            setForm({
                name: '', slug: '', domain: '', email: '', admin_email: '',
                admin_password: '', admin_first_name: '', admin_last_name: '', country: 'India'
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setSubmitError(err.data?.detail || "Failed to create university");
        }
    };

    const handleChange = (field: keyof CreateTenantRequest, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Add New University</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="University Name"
                                fullWidth
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Custom Domain (Optional)"
                                fullWidth
                                placeholder="e.g. university.com"
                                value={form.domain || ''}
                                onChange={(e) => handleChange('domain', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="URL Slug (e.g. iit-delhi)"
                                fullWidth
                                value={form.slug}
                                onChange={(e) => handleChange('slug', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Contact Email"
                                fullWidth
                                value={form.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Administrator Details</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="First Name"
                                fullWidth
                                value={form.admin_first_name}
                                onChange={(e) => handleChange('admin_first_name', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Last Name"
                                fullWidth
                                value={form.admin_last_name}
                                onChange={(e) => handleChange('admin_last_name', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Admin Email"
                                fullWidth
                                value={form.admin_email}
                                onChange={(e) => handleChange('admin_email', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Password"
                                type="password"
                                fullWidth
                                value={form.admin_password}
                                onChange={(e) => handleChange('admin_password', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit}>Create University</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateTenantDialog;
