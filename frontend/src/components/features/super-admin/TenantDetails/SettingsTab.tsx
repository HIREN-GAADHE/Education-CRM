import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Paper,
    TextField,
    Typography,
    Button,
    Alert,
    MenuItem
} from '@mui/material';
import { TenantDetail, useUpdateTenantMutation, useUploadTenantLogoMutation, useDeleteTenantLogoMutation, UpdateTenantRequest } from '@/store/api/superAdminApi';


// Helper for properly constructing API URLs
const getLogoUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const urlObj = new URL(apiUrl);
        // Avoid double slash if logo_url starts with /
        return `${urlObj.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch (e) {
        return url;
    }
};

interface SettingsTabProps {
    tenant: TenantDetail;
    refetch: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ tenant, refetch }) => {
    const [updateTenant, { isLoading }] = useUpdateTenantMutation();
    const [uploadLogo, { isLoading: isUploading }] = useUploadTenantLogoMutation();
    const [deleteLogo, { isLoading: isDeleting }] = useDeleteTenantLogoMutation();
    const [form, setForm] = useState<UpdateTenantRequest>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Initial form state
    useEffect(() => {
        setForm({
            name: tenant.name,
            status: tenant.status,
            domain: tenant.domain || '',
            // Add other editable fields if UpdateTenantRequest supports them
        });
    }, [tenant]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await uploadLogo({ tenantId: tenant.id, file }).unwrap();
            setMessage({ type: 'success', text: 'Logo uploaded successfully' });
            refetch(); // Refetch to show new logo if applicable
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to upload logo' });
        }
    };

    const handleRemoveLogo = async () => {
        if (!confirm('Are you sure you want to remove the logo?')) return;
        try {
            await deleteLogo(tenant.id).unwrap();
            setMessage({ type: 'success', text: 'Logo removed successfully' });
            refetch();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to remove logo' });
        }
    };

    const handleSubmit = async () => {
        try {
            setMessage(null);
            await updateTenant({
                id: tenant.id,
                data: form
            }).unwrap();
            setMessage({ type: 'success', text: 'University details updated successfully' });
            refetch();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.data?.detail || "Failed to update details" });
        }
    };

    // Access logo_url from tenant (might be missing in type definition but present in payload)
    const logoUrl = (tenant as any).logo_url;

    return (
        <Box maxWidth="md">
            <Paper variant="outlined" sx={{ p: 4, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 3 }}>Logo & Branding</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: 2,
                            border: '1px dashed #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            bgcolor: '#f5f5f5'
                        }}
                    >
                        {logoUrl ? (
                            <img
                                src={getLogoUrl(logoUrl)}
                                alt="Logo"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        ) : (
                            <Typography variant="caption" color="text.secondary">No Logo</Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Button variant="outlined" component="label" disabled={isUploading}>
                            {isUploading ? 'Uploading...' : 'Upload Logo'}
                            <input
                                type="hidden"
                                accept="image/*"
                            />
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={handleLogoUpload}
                            />
                        </Button>
                        {logoUrl && (
                            <Button
                                color="error"
                                size="small"
                                onClick={handleRemoveLogo}
                                disabled={isDeleting}
                            >
                                Remove Logo
                            </Button>
                        )}
                    </Box>
                </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ mb: 3 }}>General Settings</Typography>
                {message && <Alert severity={message.type} sx={{ mb: 3 }}>{message.text}</Alert>}

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <TextField
                            label="University Name"
                            fullWidth
                            value={form.name || ''}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Custom Domain (e.g. university.com)"
                            fullWidth
                            value={form.domain || ''}
                            onChange={(e) => setForm({ ...form, domain: e.target.value })}
                            helperText="Leave empty to use default subdomain"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            label="Status"
                            fullWidth
                            value={form.status || 'active'}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="suspended">Suspended</MenuItem>
                            <MenuItem value="archived">Archived</MenuItem>
                        </TextField>
                    </Grid>

                    {/* Additional Details */}
                    <Grid item xs={12} sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Contact Information</Typography>
                    </Grid>
                    {/* Note: UpdateTenantRequest needs to support these fields. 
                        We updated backend schema TenantUpdate already, need to ensure frontend type has them
                    */}

                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default SettingsTab;
