import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Avatar, Chip, Button,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, Alert, Checkbox, FormControlLabel, FormGroup, Divider,
    Tooltip
} from '@mui/material';
import {
    Security as SecurityIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import {
    useGetRolesQuery,
    useCreateRoleMutation,
    useUpdateRoleMutation,
    useDeleteRoleMutation,
    useGetModulesQuery,
    Role
} from '@/store/api/roleApi';
import { toast } from 'react-toastify';
import * as Icons from '@mui/icons-material';

const RolesPage: React.FC = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        level: 3, // Default to staff level
        color: '#666666',
        allowed_modules: [] as string[],
    });

    // API hooks
    const { data, isLoading, error, refetch } = useGetRolesQuery();
    const { data: modules = [] } = useGetModulesQuery();
    const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
    const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
    const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

    const handleOpenCreate = () => {
        setEditingRole(null);
        setFormData({
            name: '',
            display_name: '',
            description: '',
            level: 3,
            color: '#666666',
            allowed_modules: [],
        });
        setOpenDialog(true);
    };

    const handleOpenEdit = (role: Role) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            display_name: role.display_name,
            description: role.description || '',
            level: role.level,
            color: role.color || '#666666',
            allowed_modules: role.allowed_modules || [],
        });
        setOpenDialog(true);
    };

    const handleSubmit = async () => {
        try {
            if (editingRole) {
                await updateRole({ id: editingRole.id, data: formData }).unwrap();
                toast.success('Role updated successfully!');
            } else {
                await createRole(formData).unwrap();
                toast.success('Role created successfully!');
            }
            setOpenDialog(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteRole(id).unwrap();
            toast.success('Role deleted successfully!');
            setDeleteConfirm(null);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const handleModuleToggle = (moduleKey: string) => {
        setFormData(prev => {
            const current = prev.allowed_modules;
            const isSelected = current.includes(moduleKey);

            if (isSelected) {
                return { ...prev, allowed_modules: current.filter(k => k !== moduleKey) };
            } else {
                return { ...prev, allowed_modules: [...current, moduleKey] };
            }
        });
    };

    // Group modules by category
    const groupedModules = modules.reduce((acc, module) => {
        if (!acc[module.category]) {
            acc[module.category] = [];
        }
        acc[module.category].push(module);
        return acc;
    }, {} as Record<string, typeof modules>);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Roles & Permissions
                    </Typography>
                    <Typography color="text.secondary">
                        Manage roles and access control ({data?.total || 0} roles)
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 3 }}>
                    Create Role
                </Button>
            </Box>

            {/* Loading/Error */}
            {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load roles.</Alert>}

            {/* Roles Grid */}
            <Grid container spacing={3}>
                {data?.items.map((role) => (
                    <Grid item xs={12} sm={6} lg={4} key={role.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ p: 3, flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Avatar
                                        sx={{
                                            width: 56,
                                            height: 56,
                                            background: `${role.color}20`,
                                            color: role.color,
                                        }}
                                    >
                                        <SecurityIcon />
                                    </Avatar>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {!role.is_system_role && (
                                            <>
                                                <IconButton size="small" onClick={() => handleOpenEdit(role)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" onClick={() => setDeleteConfirm(role.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </>
                                        )}
                                    </Box>
                                </Box>

                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    {role.display_name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {role.description || 'No description'}
                                </Typography>

                                <Divider sx={{ my: 2 }} />

                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                    Access & Modules
                                </Typography>

                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                                    {role.allowed_modules?.length ? (
                                        role.allowed_modules.slice(0, 5).map(modKey => {
                                            const mod = modules.find(m => m.key === modKey);
                                            return (
                                                <Chip
                                                    key={modKey}
                                                    label={mod?.name || modKey}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.7rem' }}
                                                />
                                            );
                                        })
                                    ) : (
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                            No explicit module access
                                        </Typography>
                                    )}
                                    {role.allowed_modules?.length > 5 && (
                                        <Chip
                                            label={`+${role.allowed_modules.length - 5} more`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '0.7rem' }}
                                        />
                                    )}
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2, mt: 'auto' }}>
                                    <Box sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 2,
                                        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                        textAlign: 'center',
                                    }}>
                                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                                            {role.user_count}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">Users</Typography>
                                    </Box>
                                    <Box sx={{
                                        flex: 1,
                                        p: 1,
                                        borderRadius: 2,
                                        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                        textAlign: 'center',
                                    }}>
                                        <Typography variant="body2" fontWeight="bold" color="secondary.main">
                                            {role.permissions?.length || 0}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">Permissions</Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Create/Edit Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingRole ? 'Edit Role' : 'Create New Role'}
                    <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={5}>
                            <Typography variant="h6" gutterBottom>Role Details</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Role Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                    placeholder="ROLE_NAME"
                                    required
                                    helperText="Unique identifier (e.g., LIBRARIAN)"
                                />
                                <TextField
                                    fullWidth
                                    label="Display Name"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    required
                                    helperText="Visible name (e.g., Librarian)"
                                />
                                <TextField
                                    fullWidth
                                    label="Description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    multiline
                                    rows={3}
                                />
                                <TextField
                                    fullWidth
                                    label="Color"
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    sx={{ '& input': { height: 40 } }}
                                />
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={7}>
                            <Typography variant="h6" gutterBottom>Allowed Modules</Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Select which modules users with this role can access.
                            </Typography>

                            {/* Modules Loading/Error State */}
                            {modules.length === 0 && (
                                <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 1 }}>
                                    <Typography color="text.secondary">
                                        Loading modules... If this persists, please check connection.
                                    </Typography>
                                </Box>
                            )}

                            <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                                {Object.entries(groupedModules).map(([category, catModules]) => (
                                    <Box key={category} sx={{ mb: 2 }}>
                                        <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 700 }}>
                                            {category}
                                        </Typography>
                                        <Grid container spacing={1}>
                                            {catModules.map((module) => {
                                                const IconComponent = (Icons as any)[module.icon] || Icons.Extension;
                                                return (
                                                    <Grid item xs={6} key={module.key}>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={formData.allowed_modules.includes(module.key)}
                                                                    onChange={() => handleModuleToggle(module.key)}
                                                                    size="small"
                                                                />
                                                            }
                                                            label={
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <IconComponent fontSize="small" color="action" />
                                                                    <Typography variant="body2">{module.name}</Typography>
                                                                </Box>
                                                            }
                                                            sx={{
                                                                mr: 0,
                                                                width: '100%',
                                                                '&:hover': { bgcolor: 'action.hover', borderRadius: 1 }
                                                            }}
                                                        />
                                                    </Grid>
                                                );
                                            })}
                                        </Grid>
                                        <Divider sx={{ mt: 1 }} />
                                    </Box>
                                ))}
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isCreating || isUpdating || !formData.name || !formData.display_name}
                    >
                        {isCreating || isUpdating ? <CircularProgress size={24} /> : editingRole ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this role?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                        disabled={isDeleting}
                    >
                        {isDeleting ? <CircularProgress size={24} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RolesPage;
