import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Avatar, Chip,
    TextField, Button, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, FormControl, InputLabel, Select, MenuItem, Paper, Snackbar
} from '@mui/material';
import {
    Save as SaveIcon,
    CheckCircle as PresentIcon,
    Cancel as AbsentIcon,
    AccessTime as LateIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
    useGetAttendanceQuery,
    useGetAttendanceSummaryQuery,
    useCreateBulkAttendanceMutation,
} from '@/store/api/attendanceApi';
import { useGetStudentsQuery } from '@/store/api/studentApi';
import { useGetClassesQuery } from '@/store/api/academicApi';

const AttendancePage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false, message: '', severity: 'info'
    });

    // Fetch classes
    const { data: classes, isLoading: loadingClasses } = useGetClassesQuery();

    // Fetch students by class - only when class is selected
    const { data: students, isLoading: loadingStudents, refetch: refetchStudents } = useGetStudentsQuery(
        {
            page: 1,
            pageSize: 100,
            class_id: selectedClassId || undefined,
            status: 'active'
        },
        { skip: !selectedClassId }
    );

    // Fetch existing attendance for date + class
    const { data: existingAttendance, refetch: refetchAttendance } = useGetAttendanceQuery({
        attendanceDate: selectedDate,
        attendanceType: 'student',
    }, { skip: !selectedDate });

    // Fetch summary
    const { data: summary, refetch: refetchSummary } = useGetAttendanceSummaryQuery({
        attendanceDate: selectedDate,
    }, { skip: !selectedDate });

    const [createBulkAttendance, { isLoading: isMarking }] = useCreateBulkAttendanceMutation();

    // Get selected class details
    const selectedClass = classes?.find(c => c.id === selectedClassId);

    // Initialize attendance map from existing records when class or date changes
    useEffect(() => {
        if (existingAttendance?.items && students?.items) {
            const map: Record<string, string> = {};
            // Map existing attendance for students in current class
            existingAttendance.items.forEach(record => {
                if (record.student_id) {
                    // Check if this student is in our filtered list
                    const studentInClass = students.items.find(s => s.id === record.student_id);
                    if (studentInClass) {
                        map[record.student_id] = record.status;
                    }
                }
            });
            setAttendanceMap(map);
        } else {
            setAttendanceMap({});
        }
    }, [existingAttendance, students, selectedClassId, selectedDate]);

    const handleStatusChange = (studentId: string, status: string) => {
        setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    };

    const handleMarkAll = (status: string) => {
        if (!students?.items) return;
        const map: Record<string, string> = {};
        students.items.forEach(s => {
            map[s.id] = status;
        });
        setAttendanceMap(map);
    };

    const handleSaveAttendance = async () => {
        if (!selectedClassId) {
            setSnackbar({ open: true, message: 'Please select a class first', severity: 'error' });
            return;
        }

        try {
            const records = Object.entries(attendanceMap).map(([student_id, status]) => ({
                student_id,
                status,
            }));

            if (records.length === 0) {
                setSnackbar({ open: true, message: 'No attendance to save', severity: 'error' });
                return;
            }

            const result = await createBulkAttendance({
                attendance_date: selectedDate,
                records,
            }).unwrap();

            setSnackbar({
                open: true,
                message: `Attendance saved! Created: ${result.created || 0}, Updated: ${result.updated || 0}`,
                severity: 'success'
            });
            refetchAttendance();
            refetchSummary();
        } catch (err: any) {
            setSnackbar({ open: true, message: err?.data?.detail || 'Failed to save attendance', severity: 'error' });
        }
    };

    const statusOptions = [
        { value: 'present', label: 'Present', color: '#4caf50', icon: <PresentIcon /> },
        { value: 'absent', label: 'Absent', color: '#f44336', icon: <AbsentIcon /> },
        { value: 'late', label: 'Late', color: '#ff9800', icon: <LateIcon /> },
        { value: 'half_day', label: 'Half Day', color: '#9c27b0', icon: null },
        { value: 'on_leave', label: 'On Leave', color: '#2196f3', icon: null },
    ];

    // Calculate marked students count
    const markedCount = Object.keys(attendanceMap).length;
    const totalStudents = students?.items?.length || 0;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Attendance
                    </Typography>
                    <Typography color="text.secondary">
                        Mark and manage daily attendance by class
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => { refetchStudents(); refetchAttendance(); }}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveAttendance}
                        disabled={isMarking || markedCount === 0 || !selectedClassId}
                        sx={{ borderRadius: 3 }}
                    >
                        {isMarking ? <CircularProgress size={24} /> : `Save Attendance (${markedCount}/${totalStudents})`}
                    </Button>
                </Box>
            </Box>

            {/* Filters - Class and Date Selection */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                        <FormControl fullWidth>
                            <InputLabel>Select Class *</InputLabel>
                            <Select
                                label="Select Class *"
                                value={selectedClassId}
                                onChange={(e) => {
                                    setSelectedClassId(e.target.value);
                                    setAttendanceMap({});  // Reset when class changes
                                }}
                            >
                                {loadingClasses ? (
                                    <MenuItem disabled>Loading classes...</MenuItem>
                                ) : classes?.length === 0 ? (
                                    <MenuItem disabled>No classes found</MenuItem>
                                ) : (
                                    classes?.map(c => (
                                        <MenuItem key={c.id} value={c.id}>
                                            {c.name} - Section {c.section}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            fullWidth
                            label="Date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setAttendanceMap({});  // Reset when date changes
                            }}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        {selectedClass && (
                            <Box sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200' }}>
                                <Typography variant="body2" color="primary.main" fontWeight="600">
                                    Selected: {selectedClass.name} - {selectedClass.section}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Capacity: {selectedClass.capacity} students
                                </Typography>
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </Card>

            {/* Summary Cards */}
            {summary && selectedClassId && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={2.4}>
                        <Card sx={{ bgcolor: 'grey.100' }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="h4" fontWeight="bold">{summary.total_students}</Typography>
                                <Typography variant="body2" color="text.secondary">Total</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={2.4}>
                        <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="h4" fontWeight="bold">{summary.present}</Typography>
                                <Typography variant="body2">Present</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={2.4}>
                        <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="h4" fontWeight="bold">{summary.absent}</Typography>
                                <Typography variant="body2">Absent</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={2.4}>
                        <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="h4" fontWeight="bold">{summary.late}</Typography>
                                <Typography variant="body2">Late</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={2.4}>
                        <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="h4" fontWeight="bold">{summary.on_leave + (summary.half_day || 0)}</Typography>
                                <Typography variant="body2">Leave/Half</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Select class message */}
            {!selectedClassId && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Please select a class to view and mark attendance for students.
                </Alert>
            )}

            {/* Quick Actions */}
            {selectedClassId && students?.items && students.items.length > 0 && (
                <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" color="success" onClick={() => handleMarkAll('present')}>
                        Mark All Present
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => handleMarkAll('absent')}>
                        Mark All Absent
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setAttendanceMap({})}>
                        Clear All
                    </Button>
                </Box>
            )}

            {/* Loading */}
            {selectedClassId && loadingStudents && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Student Attendance Table */}
            {selectedClassId && !loadingStudents && students?.items && students.items.length > 0 && (
                <Card>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell width={80}>Roll No</TableCell>
                                    <TableCell>Student Name</TableCell>
                                    <TableCell width={120}>Adm. No</TableCell>
                                    <TableCell align="center">Attendance Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {students.items.map((student, index) => (
                                    <TableRow key={student.id} hover>
                                        <TableCell sx={{ fontWeight: 600 }}>
                                            {student.roll_number || index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    src={student.avatar_url}
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        bgcolor: 'primary.main',
                                                        fontSize: '0.875rem'
                                                    }}
                                                >
                                                    {student.first_name[0]}{student.last_name[0]}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {student.first_name} {student.last_name}
                                                    </Typography>
                                                    {student.father_name && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            S/D of {student.father_name}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {student.admission_number}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {statusOptions.map(opt => (
                                                    <Chip
                                                        key={opt.value}
                                                        label={opt.label}
                                                        size="small"
                                                        onClick={() => handleStatusChange(student.id, opt.value)}
                                                        sx={{
                                                            cursor: 'pointer',
                                                            bgcolor: attendanceMap[student.id] === opt.value ? opt.color : 'transparent',
                                                            color: attendanceMap[student.id] === opt.value ? 'white' : 'inherit',
                                                            border: `1px solid ${opt.color}`,
                                                            '&:hover': {
                                                                bgcolor: attendanceMap[student.id] === opt.value
                                                                    ? opt.color
                                                                    : `${opt.color}20`
                                                            },
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            )}

            {/* Empty State - No students in class */}
            {selectedClassId && !loadingStudents && (!students?.items || students.items.length === 0) && (
                <Alert severity="warning">
                    No students found in the selected class. Please add students to this class first.
                </Alert>
            )}

            {/* Snackbar */}
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

export default AttendancePage;
