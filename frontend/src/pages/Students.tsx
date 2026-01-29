import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Avatar, Chip, IconButton,
    TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
    DialogActions, CircularProgress, Alert, Pagination, Stepper, Step, StepLabel,
    FormControl, InputLabel, Select, MenuItem, Divider, Table, TableBody,
    TableCell, TableHead, TableRow, Paper, FormLabel, RadioGroup, FormControlLabel, Radio,
    Menu
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    FilterList as FilterIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    RemoveCircle as RemoveIcon,
    Upload as UploadIcon,
    Download as DownloadIcon,
    FileDownload as FileDownloadIcon,
    CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import {
    useGetStudentsQuery,
    useCreateStudentMutation,
    useUpdateStudentMutation,
    useDeleteStudentMutation,
    useImportStudentsMutation,
    useLazyExportStudentsQuery,
    useLazyDownloadTemplateQuery,
} from '@/store/api/studentApi';
import type { Student, StudentCreateRequest, StudentImportResult } from '@/store/api/studentApi';
import {
    useGetFeePaymentsQuery,
    useCreateFeePaymentMutation,
    useDeleteFeePaymentMutation,
} from '@/store/api/feeApi';
import type { FeePayment } from '@/store/api/feeApi';
import { useGetClassesQuery } from '@/store/api/academicApi';
import { toast } from 'react-toastify';

interface FeeFormItem {
    id?: string; // Existing fee ID for updates
    fee_type: string;
    total_amount: number;
    academic_year: string;
    due_date: string;
    description: string;
    isNew?: boolean; // Flag for newly added fees
    isDeleted?: boolean; // Flag for fees to be deleted
}

const emptyFee: FeeFormItem = {
    fee_type: 'tuition',
    total_amount: 0,
    academic_year: '2024-25',
    due_date: '',
    description: '',
    isNew: true,
};

const initialFormData: StudentCreateRequest = {
    admission_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'male',
    blood_group: '',
    category: '',
    nationality: 'Indian',

    // Address
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',

    // Academic
    course: '',
    department: '',
    class_id: '',
    batch: '',

    // Family
    parent_email: '',
    father_name: '',
    father_phone: '',
    father_occupation: '',
    mother_name: '',
    mother_phone: '',
    mother_occupation: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relation: ''
};

const StudentsPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);

    // Import/Export state
    const [openImportDialog, setOpenImportDialog] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importResult, setImportResult] = useState<StudentImportResult | null>(null);
    const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

    // Student Form state
    const [formData, setFormData] = useState<StudentCreateRequest>(initialFormData);

    // Multiple Fees Form state
    const [fees, setFees] = useState<FeeFormItem[]>([]);

    // API hooks
    const { data: classes } = useGetClassesQuery();
    const { data, isLoading, error, refetch } = useGetStudentsQuery({
        page,
        pageSize: 9,
        search: search || undefined,
        class_id: classFilter || undefined,
    });
    const [createStudent, { isLoading: isCreating }] = useCreateStudentMutation();
    const [updateStudent, { isLoading: isUpdating }] = useUpdateStudentMutation();
    const [deleteStudent, { isLoading: isDeleting }] = useDeleteStudentMutation();
    const [createFee] = useCreateFeePaymentMutation();
    const [deleteFee] = useDeleteFeePaymentMutation();
    const [importStudents, { isLoading: isImporting }] = useImportStudentsMutation();
    const [triggerExport] = useLazyExportStudentsQuery();
    const [triggerDownloadTemplate] = useLazyDownloadTemplateQuery();

    // Fetch student's fees when editing
    const { data: studentFees, refetch: refetchFees } = useGetFeePaymentsQuery(
        { studentId: editingStudent?.id, page: 1, pageSize: 50 },
        { skip: !editingStudent?.id }
    );

    // Load existing data when editing
    useEffect(() => {
        if (editingStudent) {
            setFormData({
                admission_number: editingStudent.admission_number,
                first_name: editingStudent.first_name,
                last_name: editingStudent.last_name,
                email: editingStudent.email || '',
                phone: editingStudent.phone || '',
                date_of_birth: editingStudent.date_of_birth || '',
                gender: editingStudent.gender || 'male',
                blood_group: editingStudent.blood_group || '',
                category: editingStudent.category || '',
                nationality: editingStudent.nationality || 'Indian',

                address_line1: editingStudent.address_line1 || '',
                address_line2: editingStudent.address_line2 || '',
                city: editingStudent.city || '',
                state: editingStudent.state || '',
                pincode: editingStudent.pincode || '',
                country: editingStudent.country || 'India',

                course: editingStudent.course || '',
                department: editingStudent.department || '',
                class_id: editingStudent.class_id || '',
                batch: editingStudent.batch || '',

                father_name: editingStudent.father_name || '',
                father_phone: editingStudent.father_phone || '',
                father_occupation: editingStudent.father_occupation || '',
                mother_name: editingStudent.mother_name || '',
                mother_phone: editingStudent.mother_phone || '',
                mother_occupation: editingStudent.mother_occupation || '',
                parent_email: editingStudent.parent_email || '',
                guardian_name: editingStudent.guardian_name || '',
                guardian_phone: editingStudent.guardian_phone || '',
                guardian_relation: editingStudent.guardian_relation || ''
            });

            if (studentFees) {
                const existingFees: FeeFormItem[] = studentFees.items.map((f: FeePayment) => ({
                    id: f.id,
                    fee_type: f.fee_type,
                    total_amount: f.total_amount,
                    academic_year: f.academic_year || '2024-25',
                    due_date: f.due_date ? f.due_date.split('T')[0] : '',
                    description: f.description || '',
                    isNew: false,
                    isDeleted: false,
                }));
                setFees(existingFees);
            }
        }
    }, [editingStudent, studentFees]);

    const steps = ['Personal Details', 'Address & Contact', 'Family Info', 'Academic & Fees'];

    const handleOpenCreate = () => {
        setEditingStudent(null);
        setActiveStep(0);
        setFormData(initialFormData);
        setFees([]);
        setOpenDialog(true);
    };

    const handleOpenEdit = (student: Student) => {
        setEditingStudent(student);
        setActiveStep(0);
        // Form data populated by useEffect
        setFees([]);
        setOpenDialog(true);
    };

    const handleNext = () => setActiveStep((prev) => prev + 1);
    const handleBack = () => setActiveStep((prev) => prev - 1);

    const addFee = () => {
        setFees([...fees, { ...emptyFee }]);
    };

    const updateFee = (index: number, field: keyof FeeFormItem, value: any) => {
        const updated = [...fees];
        updated[index] = { ...updated[index], [field]: value };
        setFees(updated);
    };

    const removeFee = (index: number) => {
        const fee = fees[index];
        if (fee.id && !fee.isNew) {
            const updated = [...fees];
            updated[index] = { ...updated[index], isDeleted: true };
            setFees(updated);
        } else {
            setFees(fees.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async () => {
        try {
            let studentId: string | undefined;

            // Comprehensive sanitization: convert empty strings to undefined for optional fields
            // This prevents Pydantic validation errors for EmailStr, UUID, date fields, etc.
            const sanitizedData = {
                ...formData,
                // UUID fields - convert empty string to undefined
                class_id: formData.class_id || undefined,

                // Email fields - convert empty string to undefined (Pydantic EmailStr validation)
                email: formData.email || undefined,
                parent_email: formData.parent_email || undefined,

                // Date fields - convert empty string to undefined
                date_of_birth: formData.date_of_birth || undefined,

                // Optional string fields that should be undefined if empty
                middle_name: formData.middle_name || undefined,
                roll_number: formData.roll_number || undefined,
                religion: formData.religion || undefined,
                caste: formData.caste || undefined,
                alternate_phone: formData.alternate_phone || undefined,
                admission_type: formData.admission_type || undefined,
            };

            if (editingStudent) {
                await updateStudent({ id: editingStudent.id, data: sanitizedData }).unwrap();
                studentId = editingStudent.id;
                toast.success('Student updated successfully!');
            } else {
                const student = await createStudent(sanitizedData).unwrap();
                studentId = student.id;
                toast.success('Student created successfully!');
            }

            // Process fees
            const activeFees = fees.filter(f => !f.isDeleted);
            const deletedFees = fees.filter(f => f.isDeleted && f.id);

            for (const fee of deletedFees) {
                if (fee.id) await deleteFee(fee.id).unwrap();
            }

            for (const fee of activeFees) {
                if (fee.isNew && fee.total_amount > 0 && studentId) {
                    await createFee({
                        student_id: studentId,
                        fee_type: fee.fee_type,
                        total_amount: fee.total_amount,
                        academic_year: fee.academic_year,
                        due_date: fee.due_date || undefined,
                        description: fee.description || `${fee.fee_type} fee`,
                    }).unwrap();
                }
            }

            if (activeFees.some(f => f.isNew && f.total_amount > 0)) {
                toast.success('Fee records updated!');
            }

            setOpenDialog(false);
            refetch();
            if (editingStudent) refetchFees();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteStudent(id).unwrap();
            toast.success('Student deleted successfully!');
            setDeleteConfirm(null);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const isStepValid = (step: number) => {
        if (step === 0) {
            return formData.first_name && formData.last_name && formData.admission_number;
        }
        return true;
    };

    const feeTypes = [
        { value: 'tuition', label: 'Tuition Fee' },
        { value: 'admission', label: 'Admission Fee' },
        { value: 'examination', label: 'Examination Fee' },
        { value: 'laboratory', label: 'Laboratory Fee' },
        { value: 'transport', label: 'Transport Fee' },
        { value: 'sports', label: 'Sports Fee' },
        { value: 'other', label: 'Other' },
    ];

    // Import/Export Handlers
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const validTypes = ['.csv', '.xlsx', '.xls'];
            const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (validTypes.includes(fileExt)) {
                setSelectedFile(file);
                setImportResult(null);
            } else {
                toast.error('Invalid file type. Please select CSV or Excel file.');
            }
        }
    };

    const handleImport = async () => {
        if (!selectedFile) {
            toast.error('Please select a file first');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const result = await importStudents(formData).unwrap();
            setImportResult(result);

            if (result.successful > 0) {
                toast.success(`Successfully imported ${result.successful} student(s)!`);
                refetch(); // Refresh student list
            }
            if (result.failed > 0) {
                toast.warning(`${result.failed} record(s) failed. Check error details below.`);
            }
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Import failed');
        }
    };

    const handleExport = async (format: 'csv' | 'excel') => {
        try {
            const result = await triggerExport({
                format,
                search: search || undefined,
                class_id: classFilter || undefined,
            }).unwrap();

            // Create download link
            const url = window.URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            a.download = `students_export.${format === 'csv' ? 'csv' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Students exported as ${format.toUpperCase()}`);
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Export failed');
        }
        setExportMenuAnchor(null);
    };

    const handleDownloadTemplate = async () => {
        try {
            const result = await triggerDownloadTemplate().unwrap();

            // Create download link
            const url = window.URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'student_import_template.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('Template downloaded successfully');
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Template download failed');
        }
    };

    const handleCloseImportDialog = () => {
        setOpenImportDialog(false);
        setSelectedFile(null);
        setImportResult(null);
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
                        Students
                    </Typography>
                    <Typography color="text.secondary">
                        Manage student records ({data?.total || 0} total)
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        onClick={() => setOpenImportDialog(true)}
                        sx={{ borderRadius: 3 }}
                    >
                        Import
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                        sx={{ borderRadius: 3 }}
                    >
                        Export
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreate}
                        sx={{ borderRadius: 3 }}
                    >
                        Add Student
                    </Button>
                </Box>
            </Box>

            {/* Search & Filter */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder="Search by name or admission number..."
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
                        <Select value={classFilter} label="Class" onChange={(e) => setClassFilter(e.target.value)}>
                            <MenuItem value="">All Classes</MenuItem>
                            {classes?.map((cls) => (
                                <MenuItem key={cls.id} value={cls.id}>{cls.name} - {cls.section}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Card>

            {/* Content State */}
            {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load students.</Alert>}

            <Grid container spacing={3}>
                {data?.items.map((student) => (
                    <Grid item xs={12} sm={6} md={4} key={student.id}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Avatar sx={{ width: 64, height: 64, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontSize: '1.5rem' }}>
                                        {student.first_name[0]}{student.last_name[0]}
                                    </Avatar>
                                    <Box>
                                        <IconButton size="small" onClick={() => handleOpenEdit(student)}><EditIcon fontSize="small" /></IconButton>
                                        <IconButton size="small" onClick={() => setDeleteConfirm(student.id)}><DeleteIcon fontSize="small" /></IconButton>
                                    </Box>
                                </Box>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>{student.first_name} {student.last_name}</Typography>
                                <Typography variant="body2" color="text.secondary">Adm: {student.admission_number}</Typography>
                                <Typography variant="body2" color="text.secondary">{student.email}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                                    {classes?.find(c => c.id === student.class_id) && (
                                        <Chip label={`${classes.find(c => c.id === student.class_id)?.name}-${classes.find(c => c.id === student.class_id)?.section}`} size="small" color="primary" variant="outlined" />
                                    )}
                                    <Chip label={student.status} size="small" color={student.status === 'active' ? 'success' : 'default'} />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {data && data.total_pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Pagination count={data.total_pages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                </Box>
            )}

            {/* Create/Edit Wizard Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingStudent ? 'Edit Student Profile' : 'Student Registration'}
                    <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
                        {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                    </Stepper>

                    {/* Step 0: Personal Details */}
                    {activeStep === 0 && (
                        <Grid container spacing={2}>
                            <Grid item xs={12}><Typography variant="subtitle2" color="primary">Basic Identity</Typography></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Admission Number *" value={formData.admission_number} onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="First Name *" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Last Name *" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></Grid>

                            <Grid item xs={12}><Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>Demographics</Typography></Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField fullWidth label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Gender</InputLabel>
                                    <Select value={formData.gender} label="Gender" onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}>
                                        <MenuItem value="male">Male</MenuItem>
                                        <MenuItem value="female">Female</MenuItem>
                                        <MenuItem value="other">Other</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Blood Group" value={formData.blood_group} onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Nationality" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}>
                                <FormControl fullWidth>
                                    <InputLabel>Category</InputLabel>
                                    <Select value={formData.category} label="Category" onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                                        <MenuItem value="General">General</MenuItem>
                                        <MenuItem value="OBC">OBC</MenuItem>
                                        <MenuItem value="SC">SC</MenuItem>
                                        <MenuItem value="ST">ST</MenuItem>
                                        <MenuItem value="Other">Other</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    )}

                    {/* Step 1: Address & Contact */}
                    {activeStep === 1 && (
                        <Grid container spacing={2}>
                            <Grid item xs={12}><Typography variant="subtitle2" color="primary">Contact Info</Typography></Grid>
                            <Grid item xs={12} sm={6}><TextField fullWidth label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Grid>

                            <Grid item xs={12}><Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>Residential Address</Typography></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Address Line 1" value={formData.address_line1} onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })} /></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Address Line 2" value={formData.address_line2} onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })} /></Grid>
                            <Grid item xs={6} sm={6}><TextField fullWidth label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></Grid>
                            <Grid item xs={6} sm={6}><TextField fullWidth label="State" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} /></Grid>
                            <Grid item xs={6} sm={6}><TextField fullWidth label="Pincode" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} /></Grid>
                            <Grid item xs={6} sm={6}><TextField fullWidth label="Country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} /></Grid>
                        </Grid>
                    )}

                    {/* Step 2: Family Info */}
                    {activeStep === 2 && (
                        <Grid container spacing={2}>
                            <Grid item xs={12}><Typography variant="subtitle2" color="primary">Family Contact</Typography></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Parent Email" type="email" value={formData.parent_email} onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })} helperText="Single contact email for parents" /></Grid>

                            <Grid item xs={12}><Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>Father's Details</Typography></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Father's Name" value={formData.father_name} onChange={(e) => setFormData({ ...formData, father_name: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Occupation" value={formData.father_occupation} onChange={(e) => setFormData({ ...formData, father_occupation: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Phone" value={formData.father_phone} onChange={(e) => setFormData({ ...formData, father_phone: e.target.value })} /></Grid>

                            <Grid item xs={12}><Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>Mother's Details</Typography></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Mother's Name" value={formData.mother_name} onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Occupation" value={formData.mother_occupation} onChange={(e) => setFormData({ ...formData, mother_occupation: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Phone" value={formData.mother_phone} onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })} /></Grid>

                            <Grid item xs={12}><Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>Guardian (Optional)</Typography></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Guardian Name" value={formData.guardian_name} onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Relation" value={formData.guardian_relation} onChange={(e) => setFormData({ ...formData, guardian_relation: e.target.value })} placeholder="e.g. Uncle" /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Phone" value={formData.guardian_phone} onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })} /></Grid>
                        </Grid>
                    )}

                    {/* Step 3: Academic & Fees */}
                    {activeStep === 3 && (
                        <Box>
                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                <Grid item xs={12}><Typography variant="subtitle2" color="primary">Academic Enrollment</Typography></Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Class & Section</InputLabel>
                                        <Select value={formData.class_id} label="Class & Section" onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>
                                            <MenuItem value=""><em>None</em></MenuItem>
                                            {classes?.map((cls) => (
                                                <MenuItem key={cls.id} value={cls.id}>{cls.name} - {cls.section}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}><TextField fullWidth label="Batch / Year" value={formData.batch} onChange={(e) => setFormData({ ...formData, batch: e.target.value })} /></Grid>
                                <Grid item xs={12} sm={6}><TextField fullWidth label="Course / Stream" value={formData.course} onChange={(e) => setFormData({ ...formData, course: e.target.value })} /></Grid>
                                <Grid item xs={12} sm={6}><TextField fullWidth label="Department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} /></Grid>
                            </Grid>

                            <Divider sx={{ mb: 2 }} />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle1" fontWeight="bold">Initial Fees</Typography>
                                <Button startIcon={<AddIcon />} size="small" onClick={addFee}>Add Fee</Button>
                            </Box>

                            {fees.filter(f => !f.isDeleted).length > 0 ? (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow><TableCell>Type</TableCell><TableCell>Amount</TableCell><TableCell>Due Date</TableCell><TableCell></TableCell></TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {fees.map((fee, index) => !fee.isDeleted && (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    <Select size="small" value={fee.fee_type} onChange={(e) => updateFee(index, 'fee_type', e.target.value)} disabled={!fee.isNew} sx={{ width: 120 }}>
                                                        {feeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                                                    </Select>
                                                </TableCell>
                                                <TableCell><TextField size="small" type="number" value={fee.total_amount} onChange={(e) => updateFee(index, 'total_amount', Number(e.target.value))} disabled={!fee.isNew} sx={{ width: 100 }} /></TableCell>
                                                <TableCell><TextField size="small" type="date" value={fee.due_date} onChange={(e) => updateFee(index, 'due_date', e.target.value)} disabled={!fee.isNew} /></TableCell>
                                                <TableCell><IconButton size="small" color="error" onClick={() => removeFee(index)}><RemoveIcon fontSize="small" /></IconButton></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <Typography variant="body2" color="text.secondary" align="center">No initial fees added.</Typography>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>Back</Button>
                    {activeStep === steps.length - 1 ? (
                        <Button variant="contained" onClick={handleSubmit} disabled={isCreating || isUpdating}>{isCreating || isUpdating ? <CircularProgress size={24} /> : 'Submit'}</Button>
                    ) : (
                        <Button variant="contained" onClick={handleNext} disabled={!isStepValid(activeStep)}>Next</Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent><Typography>Are you sure you want to delete this student?</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={openImportDialog} onClose={handleCloseImportDialog} maxWidth="md" fullWidth>
                <DialogTitle>
                    Import Students
                    <IconButton onClick={handleCloseImportDialog} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {!importResult ? (
                        <Box>
                            <Alert severity="info" sx={{ mb: 3 }}>
                                Upload a CSV or Excel file (.xlsx, .xls) with student data.
                                <Button
                                    size="small"
                                    startIcon={<FileDownloadIcon />}
                                    onClick={handleDownloadTemplate}
                                    sx={{ ml: 1 }}
                                >
                                    Download Template
                                </Button>
                            </Alert>

                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 4,
                                    textAlign: 'center',
                                    borderStyle: 'dashed',
                                    backgroundColor: 'action.hover',
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'action.selected' }
                                }}
                                onClick={() => document.getElementById('file-upload')?.click()}
                            >
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>
                                    {selectedFile ? selectedFile.name : 'Click to select or drag file here'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Supported formats: CSV, Excel (.xlsx, .xls)
                                </Typography>
                            </Paper>

                            {selectedFile && (
                                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        label={selectedFile.name}
                                        onDelete={() => setSelectedFile(null)}
                                        color="primary"
                                        variant="outlined"
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        ({(selectedFile.size / 1024).toFixed(2)} KB)
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        <Box>
                            <Alert severity={importResult.failed === 0 ? 'success' : 'warning'} sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>Import Complete</Typography>
                                <Typography variant="body2">
                                    Total: {importResult.total_rows} |
                                    Successful: {importResult.successful} |
                                    Failed: {importResult.failed}
                                </Typography>
                            </Alert>

                            {importResult.errors.length > 0 && (
                                <Box>
                                    <Typography variant="subtitle2" color="error" gutterBottom>
                                        Error Details ({importResult.errors.length})
                                    </Typography>
                                    <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Row</TableCell>
                                                    <TableCell>Field</TableCell>
                                                    <TableCell>Error Message</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {importResult.errors.map((error, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>{error.row}</TableCell>
                                                        <TableCell>{error.field || '-'}</TableCell>
                                                        <TableCell>{error.message}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCloseImportDialog}>
                        {importResult ? 'Close' : 'Cancel'}
                    </Button>
                    {!importResult && (
                        <Button
                            variant="contained"
                            onClick={handleImport}
                            disabled={!selectedFile || isImporting}
                            startIcon={isImporting ? <CircularProgress size={20} /> : <UploadIcon />}
                        >
                            {isImporting ? 'Importing...' : 'Import'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Export Menu */}
            <Menu
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
                anchorEl={exportMenuAnchor}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={() => handleExport('csv')}>
                    <FileDownloadIcon sx={{ mr: 1 }} /> Export as CSV
                </MenuItem>
                <MenuItem onClick={() => handleExport('excel')}>
                    <FileDownloadIcon sx={{ mr: 1 }} /> Export as Excel
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default StudentsPage;
