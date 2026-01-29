import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, IconButton, CircularProgress,
    Alert, MenuItem, Select, FormControl, InputLabel, Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Close as CloseIcon, Class as ClassIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
    useGetClassesQuery,
    useCreateClassMutation,
    useUpdateClassMutation,
    useDeleteClassMutation,
} from '@/store/api/academicApi';
import { useGetStaffQuery } from '@/store/api/staffApi';
import { SchoolClass } from '@/types';

const ClassesPage: React.FC = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        section: '',
        capacity: 40,
        class_teacher_id: '',
    });

    const { data: classes, isLoading, error } = useGetClassesQuery();
    const { data: staffData } = useGetStaffQuery({ page: 1, pageSize: 100, staffType: 'teaching' }); // Fetch teachers

    const [createClass, { isLoading: isCreating }] = useCreateClassMutation();
    const [updateClass, { isLoading: isUpdating }] = useUpdateClassMutation();
    const [deleteClass, { isLoading: isDeleting }] = useDeleteClassMutation();

    const teachers = staffData?.items || [];

    const handleOpenCreate = () => {
        setEditingClass(null);
        setFormData({ name: '', section: '', capacity: 40, class_teacher_id: '' });
        setOpenDialog(true);
    };

    const handleOpenEdit = (cls: SchoolClass) => {
        setEditingClass(cls);
        setFormData({
            name: cls.name,
            section: cls.section,
            capacity: cls.capacity,
            class_teacher_id: cls.class_teacher_id || '',
        });
        setOpenDialog(true);
    };

    const handleSubmit = async () => {
        try {
            // Sanitize payload: convert empty string to undefined for UUID fields
            const payload = {
                ...formData,
                class_teacher_id: formData.class_teacher_id || undefined,
            };

            if (editingClass) {
                await updateClass({ id: editingClass.id, data: payload }).unwrap();
                toast.success('Class updated successfully');
            } else {
                await createClass(payload).unwrap();
                toast.success('Class created successfully');
            }
            setOpenDialog(false);
        } catch (err: any) {
            const errorMessage = err?.data?.detail || err?.message || 'Operation failed';
            toast.error(errorMessage);
            console.error('Class operation error:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this class?')) {
            try {
                await deleteClass(id).unwrap();
                toast.success('Class deleted successfully');
            } catch (err: any) {
                const errorMessage = err?.data?.detail || err?.message || 'Delete failed';
                toast.error(errorMessage);
                console.error('Class delete error:', err);
            }
        }
    };

    const getTeacherName = (id?: string) => {
        if (!id) return 'Unassigned';
        const teacher = teachers.find(t => t.id === id);
        return teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unknown';
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
                        Classes & Sections
                    </Typography>
                    <Typography color="text.secondary">
                        Manage academic standards and sections
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                    Add Class
                </Button>
            </Box>

            {isLoading && <CircularProgress />}
            {error && <Alert severity="error">Failed to load classes</Alert>}

            <Grid container spacing={3}>
                {classes?.map((cls) => (
                    <Grid item xs={12} sm={6} md={4} key={cls.id}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ClassIcon color="primary" />
                                        <Typography variant="h6">Class {cls.name} - {cls.section}</Typography>
                                    </Box>
                                    <Box>
                                        <IconButton size="small" onClick={() => handleOpenEdit(cls)}><EditIcon fontSize="small" /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete(cls.id)}><DeleteIcon fontSize="small" /></IconButton>
                                    </Box>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    Teacher: {getTeacherName(cls.class_teacher_id)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Capacity: {cls.capacity} students
                                </Typography>
                                <Box sx={{ mt: 2 }}>
                                    <Chip label="Active" size="small" color="success" variant="outlined" />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
                {!isLoading && classes?.length === 0 && (
                    <Grid item xs={12}>
                        <Alert severity="info">No classes found. Create one to get started.</Alert>
                    </Grid>
                )}
            </Grid>

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingClass ? 'Edit Class' : 'Add New Class'}
                    <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Class Name (Standard)"
                                placeholder="e.g. 10 or X"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Section"
                                placeholder="e.g. A"
                                value={formData.section}
                                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Capacity"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Class Teacher</InputLabel>
                                <Select
                                    value={formData.class_teacher_id}
                                    label="Class Teacher"
                                    onChange={(e) => setFormData({ ...formData, class_teacher_id: e.target.value })}
                                >
                                    <MenuItem value="">
                                        <em>None</em>
                                    </MenuItem>
                                    {teachers.map((teacher) => (
                                        <MenuItem key={teacher.id} value={teacher.id}>
                                            {teacher.first_name} {teacher.last_name} ({teacher.employee_id})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={isCreating || isUpdating}>
                        {isCreating || isUpdating ? <CircularProgress size={24} /> : (editingClass ? 'Update' : 'Create')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ClassesPage;
