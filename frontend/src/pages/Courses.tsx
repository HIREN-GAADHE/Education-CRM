import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Avatar, Chip, Button, IconButton,
    LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert, Skeleton,
    Pagination, InputAdornment, Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    MenuBook as CourseIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    People as PeopleIcon,
    AccessTime as TimeIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
    useGetCoursesQuery,
    useCreateCourseMutation,
    useUpdateCourseMutation,
    useDeleteCourseMutation,
    Course,
} from '@/store/api/courseApi';
import { toast } from 'react-toastify';

const statusColors: Record<string, string> = {
    active: '#22c55e',
    inactive: '#ef4444',
    upcoming: '#3b82f6',
    completed: '#8b5cf6',
    archived: '#64748b',
};

const defaultColors = ['#667eea', '#f5576c', '#43e97b', '#4facfe', '#f093fb', '#ffa726', '#00bcd4', '#ff5722'];

const CoursesPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [openForm, setOpenForm] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        department: '',
        duration_months: 4,
        max_students: 50,
        fee_amount: 0,
        status: 'active',
        instructor_name: '',
        color: '#667eea',
    });

    const { data: coursesData, isLoading, error, refetch } = useGetCoursesQuery({
        page,
        pageSize: 12,
        search: search || undefined,
    });

    const [createCourse, { isLoading: isCreating }] = useCreateCourseMutation();
    const [updateCourse, { isLoading: isUpdating }] = useUpdateCourseMutation();
    const [deleteCourse, { isLoading: isDeleting }] = useDeleteCourseMutation();

    const handleOpenCreate = () => {
        setEditingCourse(null);
        setFormData({
            code: '',
            name: '',
            description: '',
            department: '',
            duration_months: 4,
            max_students: 50,
            fee_amount: 0,
            status: 'active',
            instructor_name: '',
            color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
        });
        setOpenForm(true);
    };

    const handleOpenEdit = (course: Course) => {
        setEditingCourse(course);
        setFormData({
            code: course.code,
            name: course.name,
            description: course.description || '',
            department: course.department || '',
            duration_months: course.duration_months || 4,
            max_students: course.max_students || 50,
            fee_amount: course.fee_amount || 0,
            status: course.status,
            instructor_name: course.instructor_name || '',
            color: course.color || '#667eea',
        });
        setOpenForm(true);
    };

    const handleSubmit = async () => {
        if (!formData.code || !formData.name) {
            toast.error('Code and Name are required');
            return;
        }

        try {
            if (editingCourse) {
                await updateCourse({ id: editingCourse.id, data: formData }).unwrap();
                toast.success('Course updated successfully!');
            } else {
                await createCourse(formData).unwrap();
                toast.success('Course created successfully!');
            }
            setOpenForm(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteCourse(id).unwrap();
            toast.success('Course deleted!');
            setDeleteConfirm(null);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const courses = coursesData?.items || [];

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" color="text.primary">
                        Courses
                    </Typography>
                    <Typography color="text.secondary">
                        Manage courses and curriculum
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={() => refetch()}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 2 }}>
                        Add Course
                    </Button>
                </Box>
            </Box>

            {/* Search */}
            <TextField
                fullWidth
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 3, maxWidth: 400 }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" />
                        </InputAdornment>
                    ),
                }}
            />

            {/* Loading */}
            {isLoading && (
                <Grid container spacing={3}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Grid item xs={12} sm={6} lg={4} key={i}>
                            <Skeleton variant="rounded" height={220} />
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Error */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Failed to load courses. Please try again.
                </Alert>
            )}

            {/* Empty State */}
            {!isLoading && courses.length === 0 && (
                <Card sx={{ p: 6, textAlign: 'center' }}>
                    <CourseIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No courses found
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        {search ? 'Try a different search term' : 'Add your first course to get started'}
                    </Typography>
                    {!search && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                            Add Course
                        </Button>
                    )}
                </Card>
            )}

            {/* Course Grid */}
            {!isLoading && courses.length > 0 && (
                <Grid container spacing={3}>
                    {courses.map((course) => (
                        <Grid item xs={12} sm={6} lg={4} key={course.id}>
                            <Card sx={{ height: '100%', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Avatar
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                background: `${course.color || '#667eea'}20`,
                                                color: course.color || '#667eea',
                                            }}
                                        >
                                            <CourseIcon />
                                        </Avatar>
                                        <Box>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => handleOpenEdit(course)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => setDeleteConfirm(course.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>

                                    <Typography variant="h6" fontWeight="bold" gutterBottom noWrap>
                                        {course.name}
                                    </Typography>

                                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                        <Chip
                                            label={course.code}
                                            size="small"
                                            sx={{ background: `${course.color || '#667eea'}20`, color: course.color || '#667eea' }}
                                        />
                                        {course.department && (
                                            <Chip label={course.department} size="small" variant="outlined" />
                                        )}
                                        <Chip
                                            label={course.status}
                                            size="small"
                                            sx={{
                                                background: `${statusColors[course.status] || '#64748b'}20`,
                                                color: statusColors[course.status] || '#64748b',
                                                textTransform: 'capitalize',
                                            }}
                                        />
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <PeopleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {course.enrolled_count || 0}/{course.max_students || '∞'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <TimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {course.duration_months} months
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="caption" color="text.secondary">Progress</Typography>
                                            <Typography variant="caption" fontWeight="bold" sx={{ color: course.color || '#667eea' }}>
                                                {course.progress || 0}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={course.progress || 0}
                                            sx={{
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: `${course.color || '#667eea'}20`,
                                                '& .MuiLinearProgress-bar': {
                                                    borderRadius: 3,
                                                    background: course.color || '#667eea',
                                                },
                                            }}
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Pagination */}
            {coursesData && coursesData.total_pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Pagination
                        count={coursesData.total_pages}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        color="primary"
                    />
                </Box>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingCourse ? 'Edit Course' : 'Add New Course'}
                    <IconButton onClick={() => setOpenForm(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Course Code *"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Course Name *"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                multiline
                                rows={2}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Department"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Instructor"
                                value={formData.instructor_name}
                                onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Duration (months)"
                                value={formData.duration_months}
                                onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Max Students"
                                value={formData.max_students}
                                onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Fee Amount"
                                value={formData.fee_amount}
                                onChange={(e) => setFormData({ ...formData, fee_amount: parseFloat(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={formData.status}
                                    label="Status"
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="upcoming">Upcoming</MenuItem>
                                    <MenuItem value="completed">Completed</MenuItem>
                                    <MenuItem value="archived">Archived</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                type="color"
                                label="Color"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                InputProps={{
                                    sx: { height: 56 }
                                }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenForm(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isCreating || isUpdating}
                    >
                        {isCreating || isUpdating ? <CircularProgress size={24} /> : editingCourse ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Delete Course?</DialogTitle>
                <DialogContent>
                    <Typography>This action cannot be undone.</Typography>
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

export default CoursesPage;
