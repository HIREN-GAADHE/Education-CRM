import React, { useState } from 'react';
import {
    Box, Typography, Card, Avatar, Chip, Button, IconButton,
    TextField, InputAdornment, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Alert, MenuItem, Select, FormControl, InputLabel, Pagination,
    Checkbox, ListItemText, Autocomplete
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import {
    useGetUsersQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
    User
} from '@/store/api/userApi';
import { useGetRolesQuery } from '@/store/api/roleApi';

import { toast } from 'react-toastify';

const UsersPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const [openDialog, setOpenDialog] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: '',
        status: 'active',
        role_ids: [] as string[],
    });

    const [passwordError, setPasswordError] = useState('');

    const validatePassword = (password: string) => {
        const errors = [];
        if (password.length < 8) errors.push("Min 8 chars");
        if (!/[A-Z]/.test(password)) errors.push("Uppercase");
        if (!/[a-z]/.test(password)) errors.push("Lowercase");
        if (!/\d/.test(password)) errors.push("Digit");
        if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) errors.push("Special char");

        if (errors.length > 0) {
            setPasswordError(`Missing: ${errors.join(', ')}`);
            return false;
        }
        setPasswordError('');
        return true;
    };

    // API hooks
    const { data, isLoading, error, refetch } = useGetUsersQuery({
        page,
        pageSize: 10,
        search: search || undefined,

    });
    const { data: rolesData } = useGetRolesQuery();

    const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
    const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

    const handleOpenCreate = () => {
        setEditingUser(null);
        setFormData({
            email: '',
            password: '',
            first_name: '',
            last_name: '',
            phone: '',
            status: 'active',
            role_ids: [],
        });
        setOpenDialog(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '',
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone || '',
            status: user.status,
            role_ids: user.roles.map(r => r.id),
        });
        setOpenDialog(true);
    };

    const handleSubmit = async () => {
        try {
            if (editingUser) {
                const { password, ...updateData } = formData;
                await updateUser({ id: editingUser.id, data: updateData }).unwrap();
                toast.success('User updated successfully!');
            } else {
                await createUser(formData).unwrap();
                toast.success('User created successfully!');
            }
            setOpenDialog(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteUser(id).unwrap();
            toast.success('User deleted successfully!');
            setDeleteConfirm(null);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        User Management
                    </Typography>
                    <Typography color="text.secondary">
                        Manage users and access control ({data?.total || 0} users)
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 3 }}>
                    Add User
                </Button>
            </Box>

            {/* Search */}
            < Card sx={{ mb: 3, p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder="Search users..."
                        size="small"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        sx={{ flex: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />

                </Box>
            </Card >

            {/* Loading/Error States */}
            {
                isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                )
            }
            {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load users.</Alert>}

            {/* Users Table */}
            {
                !isLoading && !error && (
                    <Card>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>User</TableCell>
                                        <TableCell>Role</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Last Login</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data?.items.map((user) => (
                                        <TableRow key={user.id} hover>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Avatar sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                                                        {user.first_name[0]}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={600}>{user.first_name} {user.last_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                {user.roles.map(role => (
                                                    <Chip
                                                        key={role.id}
                                                        label={role.display_name}
                                                        size="small"
                                                        sx={{ mr: 0.5 }}
                                                    />
                                                ))}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.status}
                                                    size="small"
                                                    color={user.status === 'active' ? 'success' : 'default'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" onClick={() => handleOpenEdit(user)}><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" onClick={() => setDeleteConfirm(user.id)}><DeleteIcon fontSize="small" /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                )
            }

            {/* Pagination */}
            {
                data && data.total_pages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <Pagination count={data.total_pages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                    </Box>
                )
            }

            {/* Create/Edit Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingUser ? 'Edit User' : 'Add New User'}
                    <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                        {!editingUser && (
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, password: val });
                                    validatePassword(val);
                                }}
                                required
                                error={!!passwordError}
                                helperText={passwordError || "Min 8 chars, uppercase, lowercase, digit, special char"}
                            />
                        )}
                        <TextField
                            fullWidth
                            label="First Name"
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            required
                        />
                        <TextField
                            fullWidth
                            label="Last Name"
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            required
                        />
                        <TextField
                            fullWidth
                            label="Phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={formData.status}
                                label="Status"
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                                <MenuItem value="suspended">Suspended</MenuItem>
                            </Select>
                        </FormControl>
                        <Autocomplete
                            multiple
                            options={rolesData?.items || []}
                            getOptionLabel={(option) => option.display_name}
                            value={rolesData?.items.filter(r => formData.role_ids.includes(r.id)) || []}
                            onChange={(_, newValue) => {
                                setFormData({
                                    ...formData,
                                    role_ids: newValue.map(r => r.id)
                                });
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Role"
                                    placeholder="Select Roles"
                                />
                            )}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip
                                        key={option.id} // Added key explicitly although getTagProps usually handles it, but good practice
                                        label={option.display_name}
                                        size="small"
                                        {...getTagProps({ index })}
                                    />
                                ))
                            }
                        />
                    </Box>
                </DialogContent >
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isCreating || isUpdating || !formData.email || !formData.first_name || !!passwordError}
                    >
                        {isCreating || isUpdating ? <CircularProgress size={24} /> : editingUser ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog >

            {/* Delete Confirmation */}
            < Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this user?</Typography>
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
            </Dialog >
        </Box >
    );
};

export default UsersPage;
