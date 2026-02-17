import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, Tab, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
    LinearProgress, Avatar, Alert, CircularProgress, Skeleton, Snackbar,
    TablePagination, Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    Quiz as QuizIcon,
    Grade as GradeIcon,
    Assessment as AssessmentIcon,
    Edit as EditIcon,
    Visibility as ViewIcon,
    Download as DownloadIcon,
    Delete as DeleteIcon,
    Publish as PublishIcon
} from '@mui/icons-material';
import {
    useGetExaminationsQuery,
    useGetGradeScalesQuery,
    useCreateExaminationMutation,
    useUpdateExaminationMutation,
    useDeleteExaminationMutation,
    usePublishResultsMutation,
    useGetExamResultsQuery,
    useGetExamStatisticsQuery,
    useBulkEnterResultsMutation,
    Examination,
    ExamResultCreate,
} from '../store/api/examinationApi';
import { useGetStudentsQuery } from '../store/api/studentApi';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const EXAM_TYPES = [
    { value: 'unit_test', label: 'Unit Test' },
    { value: 'midterm', label: 'Mid-Term' },
    { value: 'final', label: 'Final' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'assignment', label: 'Assignment' },
    { value: 'project', label: 'Project' },
    { value: 'practical', label: 'Practical' },
    { value: 'oral', label: 'Oral' },
    { value: 'internal', label: 'Internal Assessment' },
];

const ExaminationsPage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [_resultsDialogOpen, setResultsDialogOpen] = useState(false);
    const [enterResultsDialogOpen, setEnterResultsDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
    const [selectedExam, setSelectedExam] = useState<Examination | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false, message: '', severity: 'info'
    });

    // API Queries
    const { data: examsData, isLoading: examsLoading, refetch: refetchExams } = useGetExaminationsQuery({
        page: page + 1,
        pageSize: rowsPerPage
    });
    const { data: gradeScalesData, isLoading: gradeLoading } = useGetGradeScalesQuery();
    const { data: resultsData, isLoading: resultsLoading, refetch: refetchResults } = useGetExamResultsQuery(
        { examinationId: selectedExamId! },
        { skip: !selectedExamId }
    );
    const { data: statsData } = useGetExamStatisticsQuery(selectedExamId!, { skip: !selectedExamId });
    const { data: studentsData } = useGetStudentsQuery({ page: 1, pageSize: 100 });

    // Mutations
    const [createExamination, { isLoading: creating }] = useCreateExaminationMutation();
    const [updateExamination, { isLoading: updating }] = useUpdateExaminationMutation();
    const [deleteExamination, { isLoading: deleting }] = useDeleteExaminationMutation();
    const [publishResults, { isLoading: publishing }] = usePublishResultsMutation();
    const [bulkEnterResults, { isLoading: enteringBulk }] = useBulkEnterResultsMutation();

    // Form state for create/edit exam
    const [examForm, setExamForm] = useState<{
        name: string;
        exam_type: 'unit_test' | 'midterm' | 'final' | 'practical' | 'assignment' | 'quiz' | 'oral' | 'internal' | 'project';
        subject_name: string;
        class_name: string;
        section: string;
        exam_date: string;
        max_marks: number;
        passing_marks: number;
        duration_minutes: number;
        academic_year: string;
        instructions: string;
    }>({
        name: '',
        exam_type: 'unit_test',
        subject_name: '',
        class_name: '',
        section: '',
        exam_date: new Date().toISOString().split('T')[0],
        max_marks: 100,
        passing_marks: 35,
        duration_minutes: 60,
        academic_year: '2025-26',
        instructions: '',
    });

    // Enter results form state
    const [resultEntries, setResultEntries] = useState<{ student_id: string; marks_obtained: string; is_absent: boolean }[]>([]);

    const resetExamForm = () => {
        setExamForm({
            name: '',
            exam_type: 'unit_test',
            subject_name: '',
            class_name: '',
            section: '',
            exam_date: new Date().toISOString().split('T')[0],
            max_marks: 100,
            passing_marks: 35,
            duration_minutes: 60,
            academic_year: '2025-26',
            instructions: '',
        });
    };

    // Helper to extract error message from various error formats
    const getErrorMessage = (error: any, defaultMsg: string): string => {
        if (error?.data?.detail) {
            const detail = error.data.detail;
            // Handle array of validation errors
            if (Array.isArray(detail)) {
                return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
            }
            // Handle string error
            if (typeof detail === 'string') {
                return detail;
            }
            // Handle object with message
            if (typeof detail === 'object' && detail.msg) {
                return detail.msg;
            }
        }
        return error?.message || defaultMsg;
    };

    const handleCreateExam = async () => {
        if (!examForm.name || !examForm.subject_name) {
            setSnackbar({ open: true, message: 'Please fill in exam name and subject', severity: 'error' });
            return;
        }
        try {
            await createExamination(examForm).unwrap();
            setDialogOpen(false);
            resetExamForm();
            refetchExams();
            setSnackbar({ open: true, message: 'Examination created successfully', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: getErrorMessage(error, 'Failed to create exam'), severity: 'error' });
        }
    };

    const handleEditExam = (exam: Examination) => {
        setSelectedExam(exam);
        setExamForm({
            name: exam.name,
            exam_type: exam.exam_type,
            subject_name: exam.subject_name || '',
            class_name: exam.class_name || '',
            section: exam.section || '',
            exam_date: exam.exam_date?.split('T')[0] || new Date().toISOString().split('T')[0],
            max_marks: exam.max_marks,
            passing_marks: exam.passing_marks || 35,
            duration_minutes: exam.duration_minutes || 60,
            academic_year: exam.academic_year || '2025-26',
            instructions: exam.instructions || '',
        });
        setEditDialogOpen(true);
    };

    const handleUpdateExam = async () => {
        if (!selectedExam) return;
        try {
            await updateExamination({ id: selectedExam.id, data: examForm }).unwrap();
            setEditDialogOpen(false);
            resetExamForm();
            setSelectedExam(null);
            refetchExams();
            setSnackbar({ open: true, message: 'Examination updated successfully', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: getErrorMessage(error, 'Failed to update exam'), severity: 'error' });
        }
    };

    const handleDeleteExam = async () => {
        if (!selectedExam) return;
        try {
            await deleteExamination(selectedExam.id).unwrap();
            setDeleteDialogOpen(false);
            setSelectedExam(null);
            refetchExams();
            setSnackbar({ open: true, message: 'Examination deleted successfully', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: getErrorMessage(error, 'Failed to delete exam'), severity: 'error' });
        }
    };

    const handlePublishResults = async (examId: string) => {
        try {
            await publishResults(examId).unwrap();
            refetchExams();
            setSnackbar({ open: true, message: 'Results published successfully', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: getErrorMessage(error, 'Failed to publish results'), severity: 'error' });
        }
    };

    const handleOpenEnterResults = (exam: Examination) => {
        setSelectedExam(exam);
        setSelectedExamId(exam.id);
        // Initialize result entries with students
        if (studentsData?.items) {
            setResultEntries(studentsData.items.map(s => ({
                student_id: s.id,
                marks_obtained: '',
                is_absent: false,
            })));
        }
        setEnterResultsDialogOpen(true);
    };

    const handleSaveResults = async () => {
        if (!selectedExamId) return;

        const results: ExamResultCreate[] = resultEntries
            .filter(r => r.marks_obtained !== '' || r.is_absent)
            .map(r => ({
                student_id: r.student_id,
                marks_obtained: r.is_absent ? undefined : parseFloat(r.marks_obtained),
                is_absent: r.is_absent,
            }));

        if (results.length === 0) {
            setSnackbar({ open: true, message: 'No results to save', severity: 'error' });
            return;
        }

        try {
            await bulkEnterResults({ examinationId: selectedExamId, results }).unwrap();
            setEnterResultsDialogOpen(false);
            setResultEntries([]);
            refetchResults();
            setSnackbar({ open: true, message: 'Results saved successfully', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: getErrorMessage(error, 'Failed to save results'), severity: 'error' });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'results_published': return 'success';
            case 'completed': return 'success';
            case 'scheduled': return 'info';
            case 'ongoing': return 'warning';
            case 'cancelled': return 'error';
            case 'draft': return 'default';
            default: return 'default';
        }
    };

    const getGradeColor = (grade: string) => {
        const colors: Record<string, string> = {
            'A+': '#4caf50', 'A': '#8bc34a', 'B+': '#cddc39',
            'B': '#ffeb3b', 'C': '#ff9800', 'D': '#ff5722', 'F': '#f44336'
        };
        return colors[grade] || '#757575';
    };

    const handleViewResults = (examId: string) => {
        setSelectedExamId(examId);
        setResultsDialogOpen(true);
    };

    // Calculate stats from real data
    const totalExams = examsData?.total || 0;
    const completedExams = examsData?.items?.filter(e => e.status === 'completed' || e.status === 'results_published').length || 0;
    const upcomingExams = examsData?.items?.filter(e => e.status === 'scheduled').length || 0;

    const handleChangePage = (_: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Get selected exam for results display
    const selectedExamForResults = examsData?.items?.find(e => e.id === selectedExamId);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    <QuizIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Examinations & Gradebook
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                    Create Exam
                </Button>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <CardContent>
                            {examsLoading ? (
                                <Skeleton variant="text" width={50} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{totalExams}</Typography>
                            )}
                            <Typography>Total Exams</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                        <CardContent>
                            {examsLoading ? (
                                <Skeleton variant="text" width={50} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{completedExams}</Typography>
                            )}
                            <Typography>Completed</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                        <CardContent>
                            {examsLoading ? (
                                <Skeleton variant="text" width={50} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <Typography variant="h4">{upcomingExams}</Typography>
                            )}
                            <Typography>Scheduled</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <CardContent>
                            <Typography variant="h4">
                                {statsData?.pass_percentage?.toFixed(0) || '--'}%
                            </Typography>
                            <Typography>Avg. Pass Rate</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab icon={<QuizIcon />} label="Examinations" />
                    <Tab icon={<GradeIcon />} label="Results" />
                    <Tab icon={<AssessmentIcon />} label="Grade Scales" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    {examsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : examsData?.items?.length === 0 ? (
                        <Alert severity="info">No examinations found. Create your first exam to get started.</Alert>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                                            <TableCell>Exam Name</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Subject</TableCell>
                                            <TableCell>Class</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Max Marks</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {examsData?.items?.map(exam => (
                                            <TableRow key={exam.id} hover>
                                                <TableCell sx={{ fontWeight: 'bold' }}>{exam.name}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={EXAM_TYPES.find(t => t.value === exam.exam_type)?.label || exam.exam_type}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>{exam.subject_name || exam.course?.name || '-'}</TableCell>
                                                <TableCell>{exam.class_name || '-'}{exam.section ? ` - ${exam.section}` : ''}</TableCell>
                                                <TableCell>
                                                    {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '-'}
                                                </TableCell>
                                                <TableCell>{exam.max_marks}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={exam.status.replace('_', ' ')}
                                                        color={getStatusColor(exam.status) as any}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="View Results">
                                                        <IconButton size="small" onClick={() => handleViewResults(exam.id)}>
                                                            <ViewIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Enter Results">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenEnterResults(exam)}
                                                            disabled={exam.status === 'results_published'}
                                                        >
                                                            <GradeIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Edit">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditExam(exam)}
                                                            disabled={exam.status === 'results_published'}
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {exam.status === 'completed' && (
                                                        <Tooltip title="Publish Results">
                                                            <IconButton
                                                                size="small"
                                                                color="success"
                                                                onClick={() => handlePublishResults(exam.id)}
                                                                disabled={publishing}
                                                            >
                                                                <PublishIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Delete">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => { setSelectedExam(exam); setDeleteDialogOpen(true); }}
                                                            disabled={exam.status === 'results_published'}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                rowsPerPageOptions={[5, 10, 25]}
                                component="div"
                                count={totalExams}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                            />
                        </>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 250 }}>
                            <InputLabel>Select Exam</InputLabel>
                            <Select
                                label="Select Exam"
                                value={selectedExamId || ''}
                                onChange={(e) => setSelectedExamId(e.target.value)}
                            >
                                {examsData?.items?.map(e => (
                                    <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            disabled={!selectedExamId}
                            sx={{ borderRadius: 3 }}
                        >
                            Export Results
                        </Button>
                    </Box>

                    {selectedExamId && statsData && (
                        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>Statistics Summary</Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">Total Students</Typography>
                                    <Typography variant="h6">{statsData.total_students}</Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">Pass Rate</Typography>
                                    <Typography variant="h6" color="success.main">{statsData.pass_percentage?.toFixed(1)}%</Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">Average</Typography>
                                    <Typography variant="h6">{statsData.average_marks?.toFixed(1)}</Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">Highest/Lowest</Typography>
                                    <Typography variant="h6">{statsData.highest_marks} / {statsData.lowest_marks}</Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {selectedExamId && resultsLoading ? (
                        <CircularProgress />
                    ) : selectedExamId && resultsData?.items ? (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell>Rank</TableCell>
                                        <TableCell>Roll No</TableCell>
                                        <TableCell>Student Name</TableCell>
                                        <TableCell>Marks</TableCell>
                                        <TableCell>Percentage</TableCell>
                                        <TableCell>Grade</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {resultsData.items.map(result => {
                                        const maxMarks = selectedExamForResults?.max_marks || 100;
                                        const passingMarks = selectedExamForResults?.passing_marks || 35;
                                        const percentage = result.percentage ?? ((result.marks_obtained || 0) / maxMarks * 100);
                                        // Use backend is_passed if available, otherwise calculate
                                        const isPassed = result.is_passed !== null && result.is_passed !== undefined
                                            ? result.is_passed
                                            : (result.marks_obtained ?? 0) >= passingMarks;
                                        return (
                                            <TableRow key={result.id}>
                                                <TableCell>
                                                    {result.is_absent ? '-' : (
                                                        result.rank && result.rank <= 3 ? (
                                                            <Chip
                                                                label={`#${result.rank}`}
                                                                size="small"
                                                                color={result.rank === 1 ? 'warning' : result.rank === 2 ? 'info' : 'default'}
                                                                sx={{ fontWeight: 'bold' }}
                                                            />
                                                        ) : result.rank || '-'
                                                    )}
                                                </TableCell>
                                                <TableCell>{result.student_roll_number || '-'}</TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar sx={{ width: 32, height: 32 }}>
                                                            {result.student_name?.[0] || '?'}
                                                        </Avatar>
                                                        {result.student_name || 'Unknown'}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {result.is_absent ? '-' : result.marks_obtained} / {maxMarks}
                                                </TableCell>
                                                <TableCell>
                                                    {result.is_absent ? (
                                                        <Typography color="error">Absent</Typography>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={Math.min(percentage, 100)}
                                                                sx={{ width: 100, height: 8, borderRadius: 4 }}
                                                                color={isPassed ? 'success' : 'error'}
                                                            />
                                                            {percentage.toFixed(1)}%
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {result.grade ? (
                                                        <Chip
                                                            label={result.grade}
                                                            sx={{ bgcolor: getGradeColor(result.grade), color: 'white' }}
                                                            size="small"
                                                        />
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {result.is_absent ? (
                                                        <Chip label="Absent" color="error" size="small" />
                                                    ) : result.is_exempted ? (
                                                        <Chip label="Exempted" color="info" size="small" />
                                                    ) : isPassed ? (
                                                        <Chip label="Pass" color="success" size="small" />
                                                    ) : (
                                                        <Chip label="Fail" color="error" size="small" />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Alert severity="info">Select an exam to view results.</Alert>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {gradeLoading ? (
                        <CircularProgress />
                    ) : gradeScalesData?.items?.length === 0 ? (
                        <Alert severity="info">No grade scales configured.</Alert>
                    ) : (
                        <>
                            {gradeScalesData?.items?.map(scale => (
                                <Box key={scale.id} sx={{ mb: 4 }}>
                                    <Typography variant="h6" gutterBottom>
                                        {scale.name}
                                        {scale.is_default && <Chip label="Default" size="small" sx={{ ml: 1 }} color="primary" />}
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {scale.levels?.map(level => (
                                            <Grid item xs={12} sm={6} md={3} key={level.id}>
                                                <Card sx={{ borderLeft: 4, borderColor: level.color || getGradeColor(level.grade) }}>
                                                    <CardContent>
                                                        <Typography variant="h3" sx={{ color: level.color || getGradeColor(level.grade) }}>
                                                            {level.grade}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {level.min_value}% - {level.max_value}%
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Grade Points: {level.grade_point}
                                                        </Typography>
                                                        {level.description && (
                                                            <Typography variant="caption" display="block" color="text.secondary">
                                                                {level.description}
                                                            </Typography>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            ))}
                        </>
                    )}
                </TabPanel>
            </Paper>

            {/* Create Exam Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create New Examination</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Exam Name"
                                value={examForm.name}
                                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    label="Type"
                                    value={examForm.exam_type}
                                    onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value as typeof examForm.exam_type })}
                                >
                                    {EXAM_TYPES.map(t => (
                                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Subject/Course"
                                value={examForm.subject_name}
                                onChange={(e) => setExamForm({ ...examForm, subject_name: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                label="Class"
                                value={examForm.class_name}
                                onChange={(e) => setExamForm({ ...examForm, class_name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                label="Section"
                                value={examForm.section}
                                onChange={(e) => setExamForm({ ...examForm, section: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Date"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={examForm.exam_date}
                                onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Duration (minutes)"
                                type="number"
                                value={examForm.duration_minutes}
                                onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value) || 60 })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Academic Year"
                                value={examForm.academic_year}
                                onChange={(e) => setExamForm({ ...examForm, academic_year: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Max Marks"
                                type="number"
                                value={examForm.max_marks}
                                onChange={(e) => setExamForm({ ...examForm, max_marks: parseInt(e.target.value) || 100 })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Passing Marks"
                                type="number"
                                value={examForm.passing_marks}
                                onChange={(e) => setExamForm({ ...examForm, passing_marks: parseInt(e.target.value) || 35 })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Instructions"
                                multiline
                                rows={3}
                                value={examForm.instructions}
                                onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setDialogOpen(false); resetExamForm(); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateExam}
                        disabled={creating || !examForm.name || !examForm.subject_name}
                    >
                        {creating ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Exam Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Edit Examination</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Exam Name"
                                value={examForm.name}
                                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    label="Type"
                                    value={examForm.exam_type}
                                    onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value as typeof examForm.exam_type })}
                                >
                                    {EXAM_TYPES.map(t => (
                                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Subject/Course"
                                value={examForm.subject_name}
                                onChange={(e) => setExamForm({ ...examForm, subject_name: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                label="Class"
                                value={examForm.class_name}
                                onChange={(e) => setExamForm({ ...examForm, class_name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                fullWidth
                                label="Section"
                                value={examForm.section}
                                onChange={(e) => setExamForm({ ...examForm, section: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Date"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={examForm.exam_date}
                                onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Duration (minutes)"
                                type="number"
                                value={examForm.duration_minutes}
                                onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value) || 60 })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Academic Year"
                                value={examForm.academic_year}
                                onChange={(e) => setExamForm({ ...examForm, academic_year: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Max Marks"
                                type="number"
                                value={examForm.max_marks}
                                onChange={(e) => setExamForm({ ...examForm, max_marks: parseInt(e.target.value) || 100 })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Passing Marks"
                                type="number"
                                value={examForm.passing_marks}
                                onChange={(e) => setExamForm({ ...examForm, passing_marks: parseInt(e.target.value) || 35 })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Instructions"
                                multiline
                                rows={3}
                                value={examForm.instructions}
                                onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setEditDialogOpen(false); resetExamForm(); setSelectedExam(null); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleUpdateExam}
                        disabled={updating || !examForm.name || !examForm.subject_name}
                    >
                        {updating ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Enter Results Dialog */}
            <Dialog open={enterResultsDialogOpen} onClose={() => setEnterResultsDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    Enter Results - {selectedExam?.name}
                    <Typography variant="body2" color="text.secondary">
                        Max Marks: {selectedExam?.max_marks} | Passing Marks: {selectedExam?.passing_marks}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <TableContainer sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Roll No</TableCell>
                                    <TableCell>Student Name</TableCell>
                                    <TableCell>Marks Obtained</TableCell>
                                    <TableCell>Absent</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {studentsData?.items?.map((student, index) => (
                                    <TableRow key={student.id}>
                                        <TableCell>{student.roll_number || student.admission_number}</TableCell>
                                        <TableCell>{student.first_name} {student.last_name}</TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                type="number"
                                                placeholder="0"
                                                value={resultEntries[index]?.marks_obtained || ''}
                                                onChange={(e) => {
                                                    const newEntries = [...resultEntries];
                                                    if (newEntries[index]) {
                                                        newEntries[index].marks_obtained = e.target.value;
                                                        newEntries[index].is_absent = false;
                                                    }
                                                    setResultEntries(newEntries);
                                                }}
                                                disabled={resultEntries[index]?.is_absent}
                                                inputProps={{ min: 0, max: selectedExam?.max_marks }}
                                                sx={{ width: 100 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={resultEntries[index]?.is_absent || false}
                                                onChange={(e) => {
                                                    const newEntries = [...resultEntries];
                                                    if (newEntries[index]) {
                                                        newEntries[index].is_absent = e.target.checked;
                                                        if (e.target.checked) {
                                                            newEntries[index].marks_obtained = '';
                                                        }
                                                    }
                                                    setResultEntries(newEntries);
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setEnterResultsDialogOpen(false); setResultEntries([]); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveResults}
                        disabled={enteringBulk}
                    >
                        {enteringBulk ? 'Saving...' : 'Save Results'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Examination</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{selectedExam?.name}"? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteExam}
                        disabled={deleting}
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ExaminationsPage;
