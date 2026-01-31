import React, { useState } from 'react';
import {
    Box, Typography, Card, Grid, Avatar, Chip, IconButton,
    TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
    DialogActions, CircularProgress, Alert, Table, TableBody, Pagination,
    TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel,
    Select, MenuItem, OutlinedInput, Checkbox, ListItemText, Tooltip
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import {
    useGetStaffQuery,
    useCreateStaffMutation,
    useUpdateStaffMutation,
    useDeleteStaffMutation,
} from '@/store/api/staffApi';
import type { Staff } from '@/store/api/staffApi';
import { useGetClassesQuery } from '@/store/api/academicApi';
import { toast } from 'react-toastify';

const StaffPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState(''); // Added filter
    const [openDialog, setOpenDialog] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        employee_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        staff_type: 'teaching',
        designation: '',
        department: '',
        qualification: '',
        experience_years: 0,
        basic_salary: 0,
        status: 'active',
        class_ids: [] as string[], // Added
    });

    const { data: classes } = useGetClassesQuery(); // Fetch classes
    const { data, isLoading, error, refetch } = useGetStaffQuery({
        page,
        pageSize: 10,
        search: search || undefined,
        class_id: classFilter || undefined, // Apply filter
    });
    const [createStaff, { isLoading: isCreating }] = useCreateStaffMutation();
    const [updateStaff, { isLoading: isUpdating }] = useUpdateStaffMutation();
    const [deleteStaff, { isLoading: isDeleting }] = useDeleteStaffMutation();

    const handleOpenCreate = () => {
        setEditingStaff(null);
        setFormData({
            employee_id: '',
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            staff_type: 'teaching',
            designation: '',
            department: '',
            qualification: '',
            experience_years: 0,
            basic_salary: 0,
            status: 'active',
            class_ids: [],
        });
        setOpenDialog(true);
    };

    const handleOpenEdit = (staff: Staff) => {
        setEditingStaff(staff);
        setFormData({
            employee_id: staff.employee_id,
            first_name: staff.first_name,
            last_name: staff.last_name,
            email: staff.email || '',
            phone: staff.phone || '',
            staff_type: staff.staff_type || 'teaching',
            designation: staff.designation || '',
            department: staff.department || '',
            qualification: staff.qualification || '',
            experience_years: staff.experience_years || 0,
            basic_salary: staff.basic_salary || 0,
            status: staff.status,
            class_ids: staff.associated_classes?.map(c => c.id) || [], // Populate
        });
        setOpenDialog(true);
    };

    const handleSubmit = async () => {
        try {
            if (editingStaff) {
                await updateStaff({ id: editingStaff.id, data: formData }).unwrap();
                toast.success('Staff updated successfully!');
            } else {
                await createStaff(formData).unwrap();
                toast.success('Staff created successfully!');
            }
            setOpenDialog(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteStaff(id).unwrap();
            toast.success('Staff deleted successfully!');
            setDeleteConfirm(null);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const staffTypes = [
        { value: 'teaching', label: 'Teaching' },
        { value: 'non_teaching', label: 'Non-Teaching' },
        { value: 'administrative', label: 'Administrative' },
        { value: 'support', label: 'Support Staff' },
    ];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Staff Management
                    </Typography>
                    <Typography color="text.secondary">
                        Manage teachers and administrative staff ({data?.total || 0} total)
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 3 }}>
                    Add Staff
                </Button>
            </Box>

            {/* Search */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder="Search staff..."
                        size="small"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        sx={{ flex: 1 }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Class</InputLabel>
                        <Select
                            value={classFilter}
                            label="Class"
                            onChange={(e) => setClassFilter(e.target.value)}
                        >
                            <MenuItem value="">All Classes</MenuItem>
                            {classes?.map((cls) => (
                                <MenuItem key={cls.id} value={cls.id}>
                                    {cls.name} - {cls.section}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Card>

            {/* Loading/Error */}
            {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load staff.</Alert>}

            {/* Staff Table */}
            {
                !isLoading && !error && (
                    <Card>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Employee</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Designation</TableCell>
                                        <TableCell>Department</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data?.items.map((staff) => (
                                        <TableRow key={staff.id} hover>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Avatar sx={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)' }}>
                                                        {staff.first_name[0]}{staff.last_name[0]}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={600}>{staff.first_name} {staff.last_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{staff.employee_id}</Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={staff.staff_type} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                                            </TableCell>
                                            <TableCell>{staff.designation || '-'}</TableCell>
                                            <TableCell>{staff.department || '-'}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={staff.status}
                                                    size="small"
                                                    color={staff.status === 'active' ? 'success' : staff.status === 'on_leave' ? 'warning' : 'default'}
                                                    sx={{ textTransform: 'capitalize' }}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => handleOpenEdit(staff)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => setDeleteConfirm(staff.id)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
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
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingStaff ? 'Edit Staff' : 'Add New Staff'}
                    <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Employee ID *" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="First Name *" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name *" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Staff Type</InputLabel>
                                <Select value={formData.staff_type} label="Staff Type" onChange={(e) => setFormData({ ...formData, staff_type: e.target.value })}>
                                    {staffTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Designation" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Qualification" value={formData.qualification} onChange={(e) => setFormData({ ...formData, qualification: e.target.value })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Experience (Years)" type="number" value={formData.experience_years} onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) })} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Basic Salary (₹)" type="number" value={formData.basic_salary} onChange={(e) => setFormData({ ...formData, basic_salary: Number(e.target.value) })} /></Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select value={formData.status} label="Status" onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="on_leave">On Leave</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Associated Classes</InputLabel>
                                <Select
                                    multiple
                                    value={formData.class_ids}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData({ ...formData, class_ids: typeof val === 'string' ? val.split(',') : val });
                                    }}
                                    input={<OutlinedInput label="Associated Classes" />}
                                    renderValue={(selected) => selected.map(id => {
                                        const c = classes?.find(cls => cls.id === id);
                                        return c ? `${c.name}-${c.section}` : id;
                                    }).join(', ')}
                                >
                                    {classes?.map((cls) => (
                                        <MenuItem key={cls.id} value={cls.id}>
                                            <Checkbox checked={formData.class_ids.indexOf(cls.id) > -1} />
                                            <ListItemText primary={`${cls.name} - ${cls.section}`} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isCreating || isUpdating || !formData.employee_id || !formData.first_name}
                    >
                        {isCreating || isUpdating ? <CircularProgress size={24} /> : editingStaff ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent><Typography>Are you sure you want to delete this staff member?</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={isDeleting}>
                        {isDeleting ? <CircularProgress size={24} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StaffPage;
