import React, { useState } from 'react';
import {
    Box, Card, CardContent, Grid, TextField, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Typography, Alert, CircularProgress, Chip,
    Tooltip
} from '@mui/material';
import { useGetAttendanceHistoryQuery } from '../store/api/attendanceApi';
import { SchoolClass } from '../types';

interface AttendanceHistoryProps {
    selectedClass: SchoolClass | undefined;
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ selectedClass }) => {
    // Default to last 7 days
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 6);

    const [startDate, setStartDate] = useState(lastWeek.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    const { data: history, isLoading } = useGetAttendanceHistoryQuery({
        startDate,
        endDate,
        course: selectedClass?.name || '',
        section: selectedClass?.section || '',
        classId: selectedClass?.id,
    }, {
        skip: !selectedClass
    });

    if (!selectedClass) {
        return (
            <Alert severity="info">Please select a class to view history.</Alert>
        );
    }

    // Generate date range array for table info
    const getDatesInRange = (start: string, end: string) => {
        const dates = [];
        let currentDate = new Date(start);
        const stopDate = new Date(end);
        while (currentDate <= stopDate) {
            dates.push(new Date(currentDate).toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return dates;
    };

    const dateColumns = history ? getDatesInRange(history.start_date, history.end_date) : [];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return 'success';
            case 'absent': return 'error';
            case 'late': return 'warning';
            case 'half_day': return 'secondary';
            case 'on_leave': return 'info';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'present': return 'P';
            case 'absent': return 'A';
            case 'late': return 'L';
            case 'half_day': return 'HD';
            case 'on_leave': return 'OL';
            default: return '-';
        }
    };

    return (
        <Box>
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6}>
                            <Typography variant="h6">
                                History: {selectedClass.name} - {selectedClass.section}
                            </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                fullWidth
                                label="Start Date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                fullWidth
                                label="End Date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                size="small"
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {isLoading && (
                <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress />
                </Box>
            )}

            {!isLoading && history && (
                <Card>
                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', zIndex: 10 }}>Student</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', zIndex: 10 }}>Admn No</TableCell>
                                    {dateColumns.map(date => (
                                        <TableCell key={date} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                                            {date.split('-').slice(1).join('/')}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.students.map(student => (
                                    <TableRow key={student.student_id} hover>
                                        <TableCell sx={{ fontWeight: 500 }}>{student.student_name}</TableCell>
                                        <TableCell>{student.admission_number}</TableCell>
                                        {dateColumns.map(date => {
                                            const record = student.attendance[date];
                                            return (
                                                <TableCell key={date} align="center" padding="none">
                                                    {record ? (
                                                        <Tooltip title={record.remarks || record.status}>
                                                            <Chip
                                                                label={getStatusLabel(record.status)}
                                                                color={getStatusColor(record.status) as any}
                                                                size="small"
                                                                sx={{
                                                                    height: 24,
                                                                    width: 24,
                                                                    borderRadius: 1,
                                                                    fontSize: '0.75rem',
                                                                    '& .MuiChip-label': { px: 0 }
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">-</Typography>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                                {history.students.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={dateColumns.length + 2} align="center">
                                            No students found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            )}
        </Box>
    );
};

export default AttendanceHistory;
