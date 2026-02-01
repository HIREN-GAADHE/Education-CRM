import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, IconButton, CircularProgress,
    DialogContentText, Alert, MenuItem, Select, FormControl, InputLabel, Chip, OutlinedInput
} from '@mui/material';
import {
    Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
    Close as CloseIcon, Class as ClassIcon,
    CloudUpload as CloudUploadIcon, FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
    useGetClassesQuery,
    useCreateClassMutation,
    useUpdateClassMutation,
    useDeleteClassMutation,
    useLazyDownloadClassTemplateQuery,
    useImportClassesMutation,
    useLazyExportClassesQuery
} from '@/store/api/academicApi';
import { useGetStaffQuery } from '@/store/api/staffApi';
import { SchoolClass } from '@/types';

const ClassesPage: React.FC = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [importDialog, setImportDialog] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResult, setImportResult] = useState<any>(null);
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
    const [deleteClass] = useDeleteClassMutation();
    const [downloadTemplate] = useLazyDownloadClassTemplateQuery();
    const [importClasses, { isLoading: isImporting }] = useImportClassesMutation();
    const [exportClasses] = useLazyExportClassesQuery();

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

    const handleDownloadTemplate = async () => {
        try {
            const blob = await downloadTemplate().unwrap();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'classes_import_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const result = await importClasses(formData).unwrap();
            setImportResult(result);
            if (result.imported > 0) {
                toast.success(`Successfully imported ${result.imported} classes`);
                if (result.errors.length === 0) {
                    setTimeout(() => {
                        setImportDialog(false);
                        setImportResult(null);
                        setImportFile(null);
                    }, 2000);
                }
            } else if (result.errors.length > 0) {
                toast.warning('Import completed with errors');
            }
        } catch (error) {
            toast.error('Import failed');
        }
    };

    const handleExport = async () => {
        try {
            const blob = await exportClasses().unwrap();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `classes_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('Failed to export classes');
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
            </Box>
            <Box>
                <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleExport}
                    sx={{ mr: 2, mb: 4 }}
                >
                    Export
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => {
                        setImportDialog(true);
                        setImportResult(null);
                        setImportFile(null);
                    }}
                    sx={{ mr: 2, mb: 4 }}
                >
                    Import
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ mb: 4 }}>
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
                                    Students: {cls.student_count} / {cls.capacity}
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

            {/* Import Dialog */}
            <Dialog open={importDialog} onClose={() => setImportDialog(false)}>
                <DialogTitle>Import Classes</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2, mt: 1 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            1. Download the template CSV file.
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<FileDownloadIcon />}
                            onClick={handleDownloadTemplate}
                            size="small"
                        >
                            Download Template
                        </Button>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            2. Fill in the class details.
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Required: name, section. Optional: capacity, class_teacher_email.
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            3. Upload the filled CSV file.
                        </Typography>
                        <Button
                            component="label"
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            sx={{ mr: 2 }}
                        >
                            Select File
                            <input
                                type="file"
                                hidden
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                            />
                        </Button>
                        {importFile && <Typography variant="caption">{importFile.name}</Typography>}
                    </Box>
                    {importResult && importResult.errors && importResult.errors.length > 0 && (
                        <Box sx={{ mt: 2, maxHeight: 150, overflow: 'auto' }}>
                            <Alert severity="warning">
                                <Typography variant="subtitle2">Import Errors:</Typography>
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    {importResult.errors.map((e: any, i: number) => (
                                        <li key={i}>Row {e.row}: {e.error}</li>
                                    ))}
                                </ul>
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImportDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleImport}
                        variant="contained"
                        disabled={!importFile || isImporting}
                    >
                        {isImporting ? <CircularProgress size={24} /> : 'Upload & Import'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
};

export default ClassesPage;
