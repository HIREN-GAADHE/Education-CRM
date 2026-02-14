import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, Tab, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, DialogContentText,
    Alert, Snackbar, CircularProgress, IconButton, FormControlLabel, Checkbox, Tooltip, Radio, RadioGroup, ListItemText
} from '@mui/material';
import {
    Add as AddIcon,
    Schedule as ScheduleIcon,
    Room as RoomIcon,

    Delete as DeleteIcon,
    Edit as EditIcon,
    DeleteSweep as DeleteSweepIcon,
    CloudUpload as CloudUploadIcon,
    FileDownload as FileDownloadIcon,
    Upload as UploadIcon,
} from '@mui/icons-material';
import {
    useGetTimeSlotsQuery,
    useGetRoomsQuery,
    useGetTimetableEntriesQuery,
    useCreateTimetableEntryMutation,
    useUpdateTimetableEntryMutation,
    useCreateTimeSlotMutation,
    useUpdateTimeSlotMutation,
    useCreateRoomMutation,
    useUpdateRoomMutation,
    useDeleteTimetableEntryMutation,
    useDeleteTimeSlotMutation,
    useDeleteRoomMutation,
    TimeSlotType,
    TimetableEntry,
    TimeSlot,
    Room,
    useImportTimetableMutation,
    useLazyExportTimetableQuery,
    useLazyDownloadTimetableTemplateQuery,
} from '../store/api/timetableApi';
import { toast } from 'react-toastify';
import { useGetStaffQuery } from '../store/api/staffApi';
import { useGetCoursesQuery } from '../store/api/courseApi';
import { useGetClassesQuery } from '../store/api/academicApi';

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


const TimetablePage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [entryDialogOpen, setEntryDialogOpen] = useState(false);
    const [slotDialogOpen, setSlotDialogOpen] = useState(false);
    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' | 'warning' });
    const [selectedClassId, setSelectedClassId] = useState('');

    // Delete Confirmation State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [slotToDelete, setSlotToDelete] = useState<string | null>(null);
    const [importDialog, setImportDialog] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResult, setImportResult] = useState<any>(null);

    // Edit mode states
    const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
    const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);

    // API Queries - fetch all including inactive so they can be reactivated
    const { data: timeSlotsData, isLoading: slotsLoading } = useGetTimeSlotsQuery({ activeOnly: false });
    const { data: roomsData, isLoading: roomsLoading } = useGetRoomsQuery({ activeOnly: false });
    const { data: classesData } = useGetClassesQuery();

    // Derived state for selection
    const selectedClass = classesData?.find(c => c.id === selectedClassId);

    const { data: entriesData, isLoading: entriesLoading, refetch } = useGetTimetableEntriesQuery({
        className: selectedClass?.name || undefined,
        section: selectedClass?.section || undefined,
    }, { skip: !selectedClassId }); // Skip if no class selected (optional, or let it fetch all if logic supports it, but usually better to wait)
    const { data: staffData } = useGetStaffQuery({ page: 1, page_size: 100, staff_type: 'teaching' });
    const { data: coursesData } = useGetCoursesQuery({ page: 1, page_size: 100 });


    // Mutations
    const [createEntry, { isLoading: creatingEntry }] = useCreateTimetableEntryMutation();
    const [updateEntry, { isLoading: updatingEntry }] = useUpdateTimetableEntryMutation();
    const [createTimeSlot, { isLoading: creatingSlot }] = useCreateTimeSlotMutation();
    const [updateTimeSlot] = useUpdateTimeSlotMutation();
    const [createRoom, { isLoading: creatingRoom }] = useCreateRoomMutation();
    const [updateRoom] = useUpdateRoomMutation();
    const [deleteEntry] = useDeleteTimetableEntryMutation();
    const [deleteTimeSlot] = useDeleteTimeSlotMutation();
    const [deleteRoom] = useDeleteRoomMutation();
    const [importTimetable, { isLoading: importingTimetable }] = useImportTimetableMutation();
    const [triggerExport] = useLazyExportTimetableQuery();
    const [triggerTemplate] = useLazyDownloadTimetableTemplateQuery();

    const handleExport = async () => {
        try {
            const blob = await triggerExport().unwrap();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timetable_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Export started successfully');
        } catch (err) {
            toast.error('Failed to export timetable');
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const blob = await triggerTemplate().unwrap();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'timetable_import_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            toast.error('Failed to download template');
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const result = await importTimetable(formData).unwrap();
            setImportResult(result);
            if (result.errors?.length === 0) {
                toast.success(`Successfully imported ${result.imported} entries`);
                setTimeout(() => {
                    setImportDialog(false);
                    setImportResult(null);
                    setImportFile(null);
                    refetch();
                }, 2000);
            } else {
                toast.warning(`Imported ${result.imported} with ${result.errors.length} errors`);
            }
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Import failed');
        }
    };

    // Entry form state
    const [entryForm, setEntryForm] = useState({
        course_id: '',
        subject_name: '',
        teacher_id: '',
        room_id: '',
        time_slot_id: '',
        day_of_week: 1,
        class_name: '',
        section: '',
    });

    const [applyToAllWeekdays, setApplyToAllWeekdays] = useState(false);

    // Slot form state
    const [slotForm, setSlotForm] = useState({
        name: '',
        code: '',
        start_time: '08:00',
        end_time: '09:00',
        slot_type: 'class' as TimeSlotType,
        order: 0,
        is_active: true,
        applied_to: 'all', // 'all' or 'specific'
        selected_class_ids: [] as string[],
    });

    // Room form state
    const [roomForm, setRoomForm] = useState({
        name: '',
        code: '',
        capacity: 40,
        room_type: 'classroom',
        building: '',
    });

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleAddEntry = async () => {
        if (!entryForm.time_slot_id) {
            setSnackbar({ open: true, message: 'Please select a time slot', severity: 'error' });
            return;
        }
        if (!entryForm.course_id && !entryForm.subject_name) {
            setSnackbar({ open: true, message: 'Please select a course or enter a subject name', severity: 'error' });
            return;
        }
        try {
            if (editingEntry) {
                // Update existing entry
                await updateEntry({
                    id: editingEntry.id,
                    data: {
                        time_slot_id: entryForm.time_slot_id,
                        day_of_week: entryForm.day_of_week,
                        course_id: entryForm.course_id || undefined,
                        subject_name: entryForm.subject_name || undefined,
                        teacher_id: entryForm.teacher_id || undefined,
                        room_id: entryForm.room_id || undefined,
                        class_name: entryForm.class_name || undefined,
                        section: entryForm.section || undefined,
                    }
                }).unwrap();
                setSnackbar({ open: true, message: 'Entry updated successfully', severity: 'success' });
            } else {
                // Create new entry/entries
                if (applyToAllWeekdays) {
                    // Create entries for Monday to Saturday (1-6)
                    const promises = [];
                    for (let day = 1; day <= 6; day++) {
                        promises.push(
                            createEntry({
                                time_slot_id: entryForm.time_slot_id,
                                day_of_week: day,
                                course_id: entryForm.course_id || undefined,
                                subject_name: entryForm.subject_name || undefined,
                                teacher_id: entryForm.teacher_id || undefined,
                                room_id: entryForm.room_id || undefined,
                                class_name: entryForm.class_name || undefined,
                                section: entryForm.section || undefined,
                            }).unwrap()
                        );
                    }
                    await Promise.all(promises);
                    setSnackbar({ open: true, message: 'Entries created for all weekdays (Mon-Sat)', severity: 'success' });
                } else {
                    // Create single entry
                    await createEntry({
                        time_slot_id: entryForm.time_slot_id,
                        day_of_week: entryForm.day_of_week,
                        course_id: entryForm.course_id || undefined,
                        subject_name: entryForm.subject_name || undefined,
                        teacher_id: entryForm.teacher_id || undefined,
                        room_id: entryForm.room_id || undefined,
                        class_name: entryForm.class_name || undefined,
                        section: entryForm.section || undefined,
                    }).unwrap();
                    setSnackbar({ open: true, message: 'Entry added successfully', severity: 'success' });
                }
            }
            setEntryDialogOpen(false);
            setEditingEntry(null);
            setApplyToAllWeekdays(false);
            setEntryForm({ course_id: '', subject_name: '', teacher_id: '', room_id: '', time_slot_id: '', day_of_week: 1, class_name: '', section: '' });
            refetch();
        } catch (error: any) {
            const detail = error.data?.detail;
            let message = 'Failed to save entry';

            if (typeof detail === 'object') {
                if (detail.conflicts && Array.isArray(detail.conflicts)) {
                    // Format conflict messages
                    const conflictMsgs = detail.conflicts.map((c: any) => {
                        if (c.blocking_slot) {
                            return `${c.message} (Blocked by ${c.blocking_subject || 'Entry'} in ${c.blocking_slot})`;
                        }
                        return c.message;
                    });
                    message = "Conflicts: " + conflictMsgs.join('; ');
                } else {
                    message = detail.message || JSON.stringify(detail);
                }
            } else if (typeof detail === 'string') {
                message = detail;
            }

            setSnackbar({ open: true, message, severity: 'error' });
        }
    };

    const handleAddSlot = async () => {
        if (!slotForm.name || !slotForm.start_time || !slotForm.end_time) {
            setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'error' });
            return;
        }
        if (slotForm.start_time >= slotForm.end_time) {
            setSnackbar({ open: true, message: 'End time must be greater than Start time', severity: 'error' });
            return;
        }
        try {
            const applicableDaysPayload = slotForm.applied_to === 'specific'
                ? { days: [1, 2, 3, 4, 5, 6], class_ids: slotForm.selected_class_ids }
                : [1, 2, 3, 4, 5, 6]; // Default global

            if (editingSlot) {
                // Update existing slot
                await updateTimeSlot({
                    id: editingSlot.id,
                    data: {
                        name: slotForm.name,
                        code: slotForm.code || undefined,
                        start_time: slotForm.start_time,
                        end_time: slotForm.end_time,
                        slot_type: slotForm.slot_type,
                        order: slotForm.order,
                        is_active: slotForm.is_active,
                        applicable_days: applicableDaysPayload as any,
                    }
                }).unwrap();
                setSnackbar({ open: true, message: 'Time slot updated successfully', severity: 'success' });
            } else {
                // Create new slot
                await createTimeSlot({
                    name: slotForm.name,
                    code: slotForm.code || undefined,
                    start_time: slotForm.start_time,
                    end_time: slotForm.end_time,
                    slot_type: slotForm.slot_type,
                    order: slotForm.order,
                    is_active: slotForm.is_active,
                    applicable_days: applicableDaysPayload,
                } as any).unwrap(); // Cast to any to bypass strict type check for now if interface not updated
                setSnackbar({ open: true, message: 'Time slot added successfully', severity: 'success' });
            }
            setSlotDialogOpen(false);
            setEditingSlot(null);
            setSlotForm({ name: '', code: '', start_time: '08:00', end_time: '09:00', slot_type: 'class', order: 0, is_active: true, applied_to: 'all', selected_class_ids: [] });
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to save slot', severity: 'error' });
        }
    };

    const handleAddRoom = async () => {
        if (!roomForm.name) {
            setSnackbar({ open: true, message: 'Please enter room name', severity: 'error' });
            return;
        }
        try {
            if (editingRoom) {
                // Update existing room
                await updateRoom({
                    id: editingRoom.id,
                    data: {
                        name: roomForm.name,
                        code: roomForm.code || undefined,
                        capacity: roomForm.capacity,
                        room_type: roomForm.room_type,
                        building: roomForm.building || undefined,
                    }
                }).unwrap();
                setSnackbar({ open: true, message: 'Room updated successfully', severity: 'success' });
            } else {
                // Create new room
                await createRoom({
                    name: roomForm.name,
                    code: roomForm.code || undefined,
                    capacity: roomForm.capacity,
                    room_type: roomForm.room_type,
                    building: roomForm.building || undefined,
                }).unwrap();
                setSnackbar({ open: true, message: 'Room added successfully', severity: 'success' });
            }
            setRoomDialogOpen(false);
            setEditingRoom(null);
            setRoomForm({ name: '', code: '', capacity: 40, room_type: 'classroom', building: '' });
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to save room', severity: 'error' });
        }
    };








    const handleDeleteRoom = async (id: string) => {
        if (confirm('Are you sure you want to delete this room?')) {
            try {
                await deleteRoom(id).unwrap();
                setSnackbar({ open: true, message: 'Room deleted', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete', severity: 'error' });
            }
        }
    };

    const handleDeleteSingleEntry = async (entry: TimetableEntry) => {
        if (confirm(`Delete entry "${entry.subject_name || entry.course?.name}" for ${dayNames[entry.day_of_week - 1]}?`)) {
            try {
                await deleteEntry(entry.id).unwrap();
                setSnackbar({ open: true, message: 'Entry deleted successfully', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete entry', severity: 'error' });
            }
        }
    };

    // Edit handlers
    const handleEditEntry = (entry: TimetableEntry) => {
        setEditingEntry(entry);
        setEntryForm({
            course_id: entry.course_id || '',
            subject_name: entry.subject_name || '',
            teacher_id: entry.teacher_id || '',
            room_id: entry.room_id || '',
            time_slot_id: entry.time_slot_id,
            day_of_week: entry.day_of_week,
            class_name: entry.class_name || '',
            section: entry.section || '',
        });
        setEntryDialogOpen(true);
    };

    const handleEditSlot = (slot: TimeSlot) => {
        setEditingSlot(slot);

        let appliedTo = 'all';
        let selectedClassIds: string[] = [];

        // Parse applicable_days to determine current setting
        if (slot.applicable_days && !Array.isArray(slot.applicable_days)) {
            // It's an object (Specific configuration)
            const config: any = slot.applicable_days;
            if (config.class_ids && Array.isArray(config.class_ids)) {
                appliedTo = 'specific';
                selectedClassIds = config.class_ids;
            }
        }

        setSlotForm({
            name: slot.name,
            code: slot.code || '',
            start_time: slot.start_time,
            end_time: slot.end_time,
            slot_type: slot.slot_type,
            order: slot.order,
            is_active: slot.is_active ?? true,
            applied_to: appliedTo,
            selected_class_ids: selectedClassIds,
        });
        setSlotDialogOpen(true);
    };

    const handleEditRoom = (room: Room) => {
        setEditingRoom(room);
        setRoomForm({
            name: room.name,
            code: room.code || '',
            capacity: room.capacity || 40,
            room_type: room.room_type,
            building: room.building || '',
        });
        setRoomDialogOpen(true);
    };

    const handleClearTimetable = async () => {
        if (!timeSlotsData?.items?.length) return;

        if (confirm('Are you sure you want to clear the entire timetable? This will DELETE ALL PERIODS and their entries. This action cannot be undone.')) {
            try {
                // Delete all slots
                const promises = timeSlotsData.items.map(slot => deleteTimeSlot(slot.id).unwrap());
                await Promise.all(promises);
                setSnackbar({ open: true, message: 'Timetable structure cleared successfully', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to clear timetable', severity: 'error' });
            }
        }
    };

    const handleDeleteRowClick = (slotId: string) => {
        setSlotToDelete(slotId);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteRow = async () => {
        if (slotToDelete) {
            try {
                await deleteTimeSlot(slotToDelete).unwrap();
                setSnackbar({ open: true, message: 'Period deleted successfully', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete period', severity: 'error' });
            } finally {
                setDeleteConfirmOpen(false);
                setSlotToDelete(null);
            }
        }
    };

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const buildTimetableGrid = () => {
        if (!timeSlotsData?.items || !entriesData?.items) {
            return { timeSlots: [], grid: {} };
        }

        const grid: Record<number, Record<string, any>> = {};

        // Initialize grid
        dayNames.forEach((_, dayIndex) => {
            grid[dayIndex + 1] = {};
        });

        // Populate with entries
        entriesData.items.forEach(entry => {
            if (grid[entry.day_of_week]) {
                grid[entry.day_of_week][entry.time_slot_id] = entry;
            }
        });

        // Filter Time Slots based on Selected Class
        let filteredSlots = [...timeSlotsData.items];

        if (selectedClass) {
            filteredSlots = filteredSlots.filter(slot => {
                // If applicable_days is an array, it applies to all (Global)
                if (Array.isArray(slot.applicable_days)) return true;

                // If it's an object with class_ids
                if (slot.applicable_days && !Array.isArray(slot.applicable_days)) {
                    const config: any = slot.applicable_days;
                    if (config.class_ids && Array.isArray(config.class_ids)) {
                        return config.class_ids.includes(selectedClass.id);
                    }
                }

                // Default fallback (e.g. if field missing, assume global or hide? Safe to assume global for backward compat)
                return true;
            });
        }

        // Sort time slots by order
        const sortedSlots = filteredSlots.sort((a, b) => a.order - b.order);

        return { timeSlots: sortedSlots, grid };
    };

    const { timeSlots, grid } = buildTimetableGrid();




    const selectedClassTeacher = staffData?.items?.find(s => s.id === selectedClass?.class_teacher_id);

    const handleCellClick = (day: number, slot: TimeSlot, entry?: TimetableEntry) => {
        if (entry) {
            handleEditEntry(entry);
        } else {
            if (!selectedClass) {
                toast.info("Please select a Class first");
                return;
            }
            // Pre-fill form for new entry
            setEntryForm({
                ...entryForm,
                time_slot_id: slot.id,
                day_of_week: day,
                class_name: selectedClass.name,
                section: selectedClass.section,
                // Reset other fields
                course_id: '',
                subject_name: '',
                teacher_id: '',
                room_id: '',
            });
            setEntryDialogOpen(true);
        }
    };



    const renderTimetableGrid = () => (
        <Box>
            {/* Class Info Header */}
            {selectedClass && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                            <Typography variant="h6" fontWeight="bold">
                                Class: {selectedClass.name} - {selectedClass.section}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                            <Typography variant="h6">
                                Class Teacher: {selectedClassTeacher ? `${selectedClassTeacher.first_name} ${selectedClassTeacher.last_name}` : 'Not Assigned'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small" sx={{
                    borderCollapse: 'separate',
                    borderSpacing: '0 2px',
                    '& .MuiTableCell-root': { borderLeft: '1px solid rgba(224, 224, 224, 1)' }
                }}>
                    <TableHead>
                        <TableRow sx={{
                            backgroundColor: 'primary.main',
                            '& th': {
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.95rem',
                                py: 2
                            }
                        }}>
                            <TableCell align="center" sx={{ width: '60px' }}>#</TableCell>
                            <TableCell align="center" sx={{ width: '130px' }}>Time</TableCell>
                            {dayNames.map(day => (
                                <TableCell key={day} align="center">
                                    {day}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {entriesLoading || slotsLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} align="center">
                                    <CircularProgress size={24} />
                                </TableCell>
                            </TableRow>
                        ) : timeSlots.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} align="center">
                                    <Alert severity="info">
                                        No time slots configured. Please configure time slots first.
                                    </Alert>
                                </TableCell>
                            </TableRow>
                        ) : (
                            timeSlots.map((slot, index) => {
                                const isBreak = ['break', 'lunch', 'assembly'].includes(slot.slot_type);
                                return (
                                    <TableRow
                                        key={slot.id}
                                        sx={{
                                            backgroundColor: isBreak ? 'warning.light' : (index % 2 === 0 ? 'action.hover' : 'inherit'),
                                            '&:hover': { backgroundColor: 'action.selected' }
                                        }}
                                    >
                                        <TableCell
                                            align="center"
                                            sx={{
                                                fontWeight: 'bold',
                                                position: 'relative',
                                                height: '100%',
                                            }}
                                            onMouseEnter={(e) => {
                                                const btn = e.currentTarget.querySelector('.delete-row-btn') as HTMLElement;
                                                if (btn) btn.style.opacity = '1';
                                            }}
                                            onMouseLeave={(e) => {
                                                const btn = e.currentTarget.querySelector('.delete-row-btn') as HTMLElement;
                                                if (btn) btn.style.opacity = '0';
                                            }}
                                        >
                                            {/* Simple Index */}
                                            {index + 1}

                                            {/* Delete Row Action */}
                                            <IconButton
                                                className="delete-row-btn"
                                                size="small"
                                                color="error"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteRowClick(slot.id);
                                                }}
                                                sx={{
                                                    opacity: 0,
                                                    transition: 'opacity 0.2s',
                                                    position: 'absolute',
                                                    left: '4px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    bgcolor: 'rgba(255,255,255,0.95)',
                                                    boxShadow: 1,
                                                    '&:hover': { bgcolor: 'white', opacity: 1 },
                                                    zIndex: 10
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                        <TableCell
                                            align="center"
                                            onClick={() => handleEditSlot(slot)}
                                            sx={{
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                                '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                                            }}
                                        >
                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                        </TableCell>

                                        {dayNames.map((_, dayIndex) => {
                                            const dayNum = dayIndex + 1;
                                            const entry = grid[dayNum]?.[slot.id];

                                            if (isBreak) {
                                                return (
                                                    <TableCell key={dayIndex} align="center" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', fontWeight: 'bold', letterSpacing: 1 }}>
                                                        {slot.name.toUpperCase()}
                                                    </TableCell>
                                                );
                                            }

                                            return (
                                                <TableCell
                                                    key={dayIndex}
                                                    align="center"
                                                    onClick={() => handleCellClick(dayNum, slot, entry)}
                                                    sx={{
                                                        minWidth: 120,
                                                        p: 0.5,
                                                        height: '80px',
                                                        verticalAlign: 'middle',
                                                        cursor: selectedClass ? 'pointer' : 'default',
                                                        backgroundColor: entry ? 'primary.50' : 'inherit',
                                                        '&:hover': { backgroundColor: selectedClass ? 'action.selected' : 'inherit' }
                                                    }}
                                                >
                                                    {entry ? (
                                                        <Box sx={{
                                                            position: 'relative',
                                                            height: '100%',
                                                            minHeight: '80px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            justifyContent: 'center',
                                                            bgcolor: 'primary.light',
                                                            color: 'primary.contrastText',
                                                            borderRadius: 2,
                                                            p: 1,
                                                            boxShadow: 2,
                                                            transition: 'all 0.2s',
                                                            '&:hover': {
                                                                transform: 'translateY(-2px)',
                                                                boxShadow: 4,
                                                                '& .action-buttons': { opacity: 1 }
                                                            }
                                                        }}>
                                                            <Typography variant="subtitle2" fontWeight="bold">
                                                                {entry.subject_name || entry.course?.name || 'Subject'}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                                                {(() => {
                                                                    if (entry.teacher && entry.teacher.first_name) {
                                                                        return `(${entry.teacher.first_name} ${entry.teacher.last_name})`;
                                                                    }
                                                                    const foundTeacher = staffData?.items?.find((s: any) => s.id === entry.teacher_id);
                                                                    if (foundTeacher) {
                                                                        return `(${foundTeacher.first_name} ${foundTeacher.last_name})`;
                                                                    }
                                                                    return '(No Teacher)';
                                                                })()}
                                                            </Typography>

                                                            {/* Only show Room if it's not the default class room (optional refinement, showing always for now) */}
                                                            {/* <Typography variant="caption" display="block" color="text.secondary">
                                                                [{entry.room?.name}]
                                                            </Typography> */}

                                                            <Box
                                                                className="action-buttons"
                                                                sx={{
                                                                    position: 'absolute',
                                                                    top: -4,
                                                                    right: -4,
                                                                    display: 'flex',
                                                                    opacity: 0,
                                                                    transition: 'opacity 0.2s',
                                                                    bgcolor: 'background.paper',
                                                                    borderRadius: '50%',
                                                                    boxShadow: 2
                                                                }}
                                                            >
                                                                <Tooltip title="Delete Entry">
                                                                    <IconButton
                                                                        size="small"
                                                                        color="error"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteSingleEntry(entry);
                                                                        }}
                                                                        sx={{ p: 0.5 }}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <AddIcon sx={{ opacity: 0, transition: 'opacity 0.2s', '.MuiTableCell-root:hover &': { opacity: 0.3 } }} />
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Timetable Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Tooltip title="Import Timetable">
                        <IconButton onClick={() => setImportDialog(true)} color="primary">
                            <CloudUploadIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Export Timetable">
                        <IconButton onClick={handleExport} color="secondary">
                            <FileDownloadIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Clear All Periods">
                        <span>
                            <IconButton onClick={handleClearTimetable} color="error" disabled={!timeSlotsData?.items?.length}>
                                <DeleteSweepIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Select Class</InputLabel>
                        <Select
                            value={selectedClassId}
                            label="Select Class"
                            onChange={(e) => setSelectedClassId(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {classesData?.map(cls => (
                                <MenuItem key={cls.id} value={cls.id}>
                                    {cls.name} {cls.section ? `- ${cls.section}` : ''}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                        const maxOrder = timeSlotsData?.items?.reduce((max: number, slot: any) => Math.max(max, slot.order || 0), 0) || 0;
                        setSlotForm({ ...slotForm, order: maxOrder + 1 });
                        setSlotDialogOpen(true);
                    }}>
                        Add Period
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab icon={<ScheduleIcon />} label="Class Timetable" />
                    <Tab icon={<RoomIcon />} label="Rooms" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <Typography variant="h6" gutterBottom>
                        {selectedClass ? `${selectedClass.name} - ${selectedClass.section} Weekly Schedule` : 'Select a class to view timetable'}
                    </Typography>
                    {renderTimetableGrid()}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRoomDialogOpen(true)}>
                            Add Room
                        </Button>
                    </Box>
                    {roomsLoading ? (
                        <CircularProgress />
                    ) : roomsData?.items?.length === 0 ? (
                        <Alert severity="info">No rooms configured. Add rooms to get started.</Alert>
                    ) : (
                        <Grid container spacing={2}>
                            {roomsData?.items?.map(room => (
                                <Grid item xs={12} sm={6} md={3} key={room.id}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Typography variant="h6">{room.name}</Typography>
                                                <Box>
                                                    <IconButton size="small" onClick={() => handleEditRoom(room)} sx={{ mr: 0.5 }}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => handleDeleteRoom(room.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                            {room.code && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Code: {room.code}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                Capacity: {room.capacity || 'N/A'}
                                            </Typography>
                                            {room.building && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Building: {room.building}
                                                </Typography>
                                            )}
                                            <Chip
                                                label={room.room_type}
                                                color="primary"
                                                size="small"
                                                sx={{ mt: 1, mr: 1 }}
                                            />
                                            <Chip
                                                label={room.is_active ? 'Available' : 'Unavailable'}
                                                color={room.is_active ? 'success' : 'default'}
                                                size="small"
                                                sx={{ mt: 1 }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </TabPanel>


            </Paper>

            {/* Import Dialog */}
            <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Import Timetable</DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Button startIcon={<FileDownloadIcon />} onClick={handleDownloadTemplate} sx={{ mb: 3 }}>
                            Download Template
                        </Button>

                        <Box
                            sx={{
                                border: '2px dashed #ccc',
                                borderRadius: 2,
                                p: 4,
                                cursor: 'pointer',
                                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
                            }}
                            component="label"
                        >
                            <input
                                type="file"
                                hidden
                                accept=".csv, .xlsx, .xls"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            />
                            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                            <Typography>{importFile ? importFile.name : 'Click to Upload CSV/Excel'}</Typography>
                        </Box>

                        {importResult && (
                            <Box sx={{ mt: 2, textAlign: 'left' }}>
                                <Alert severity={importResult.errors?.length ? 'warning' : 'success'}>
                                    Imported: {importResult.imported}, Errors: {importResult.errors?.length || 0}
                                </Alert>
                                {importResult.errors?.length > 0 && (
                                    <Box sx={{ mt: 1, maxHeight: 100, overflow: 'auto', bgcolor: 'grey.100', p: 1 }}>
                                        {importResult.errors.map((e: any, i: number) => (
                                            <Typography key={i} variant="caption" display="block" color="error">
                                                Row {e.row}: {e.error}
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImportDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleImport}
                        disabled={!importFile || importingTimetable}
                    >
                        {importingTimetable ? <CircularProgress size={24} /> : 'Import'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add/Edit Entry Dialog - Simplified */}
            <Dialog open={entryDialogOpen} onClose={() => {
                setEntryDialogOpen(false);
                setEditingEntry(null);
            }} maxWidth="xs" fullWidth>
                <DialogTitle>{editingEntry ? 'Edit Class' : 'Select Subject'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Course</InputLabel>
                                <Select
                                    label="Course"
                                    value={entryForm.course_id}
                                    onChange={(e) => {
                                        const selectedCourseId = e.target.value;
                                        const selectedCourse = coursesData?.items?.find((c: any) => c.id === selectedCourseId);
                                        setEntryForm({
                                            ...entryForm,
                                            course_id: selectedCourseId,
                                            subject_name: selectedCourse ? selectedCourse.name : ''
                                        });
                                    }}
                                >
                                    <MenuItem value="">-- Select Course --</MenuItem>
                                    {coursesData?.items?.map((course: any) => (
                                        <MenuItem key={course.id} value={course.id}>{course.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Hidden/Implicit fields */}
                        {/* Course ID is managed implicitly if matching name found, or just use subject_name string for simplicity as requested */}

                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Teacher</InputLabel>
                                <Select
                                    label="Teacher"
                                    value={entryForm.teacher_id}
                                    onChange={(e) => setEntryForm({ ...entryForm, teacher_id: e.target.value })}
                                >
                                    <MenuItem value="">-- Default / Class Teacher --</MenuItem>
                                    {staffData?.items?.map((staff: any) => (
                                        <MenuItem key={staff.id} value={staff.id}>
                                            {staff.first_name} {staff.last_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Additional fields hidden for simplicity */}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setEntryDialogOpen(false);
                        setEditingEntry(null);
                    }}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddEntry} disabled={creatingEntry || updatingEntry}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Time Slot Dialog */}
            <Dialog open={slotDialogOpen} onClose={() => setSlotDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Time Slot</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={8}>
                            <TextField
                                fullWidth
                                label="Period Name *"
                                value={slotForm.name}
                                onChange={(e) => setSlotForm({ ...slotForm, name: e.target.value })}
                                placeholder="e.g., Period 1"
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                label="Code"
                                value={slotForm.code}
                                onChange={(e) => setSlotForm({ ...slotForm, code: e.target.value })}
                                placeholder="e.g., P1"
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                label="Start Time *"
                                type="time"
                                value={slotForm.start_time}
                                onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                label="End Time *"
                                type="time"
                                value={slotForm.end_time}
                                onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                label="Order"
                                type="number"
                                value={slotForm.order}
                                onChange={(e) => setSlotForm({ ...slotForm, order: parseInt(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl component="fieldset">
                                <Typography variant="subtitle2" gutterBottom>Applies To</Typography>
                                <RadioGroup
                                    row
                                    value={slotForm.applied_to}
                                    onChange={(e) => setSlotForm({ ...slotForm, applied_to: e.target.value })}
                                >
                                    <FormControlLabel value="all" control={<Radio />} label="All Classes" />
                                    <FormControlLabel value="specific" control={<Radio />} label="Specific Classes" />
                                </RadioGroup>
                            </FormControl>
                        </Grid>
                        {slotForm.applied_to === 'specific' && (
                            <Grid item xs={12}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Select Classes</InputLabel>
                                    <Select
                                        multiple
                                        value={slotForm.selected_class_ids}
                                        onChange={(e) => setSlotForm({ ...slotForm, selected_class_ids: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
                                        renderValue={(selected) => selected.length + ' classes selected'}
                                    >
                                        {classesData?.map((cls) => (
                                            <MenuItem key={cls.id} value={cls.id}>
                                                <Checkbox checked={slotForm.selected_class_ids.indexOf(cls.id) > -1} />
                                                <ListItemText primary={`${cls.name} ${cls.section ? '- ' + cls.section : ''}`} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Slot Type</InputLabel>
                                <Select
                                    label="Slot Type"
                                    value={slotForm.slot_type}
                                    onChange={(e) => setSlotForm({ ...slotForm, slot_type: e.target.value as TimeSlotType })}
                                >
                                    <MenuItem value="class">Regular Class</MenuItem>
                                    <MenuItem value="break">Break</MenuItem>
                                    <MenuItem value="lunch">Lunch</MenuItem>
                                    <MenuItem value="assembly">Assembly</MenuItem>
                                    <MenuItem value="exam">Exam</MenuItem>
                                    <MenuItem value="free">Free Period</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSlotDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddSlot} disabled={creatingSlot}>
                        {creatingSlot ? 'Adding...' : 'Add Slot'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog for Row Deletion */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
            >
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this Period? This will delete the time slot and all associated entries (Subjects) for all days. This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={confirmDeleteRow} color="error" variant="contained" autoFocus>
                        Delete Period
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Room Dialog */}
            <Dialog open={roomDialogOpen} onClose={() => setRoomDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Room</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={8}>
                            <TextField
                                fullWidth
                                label="Room Name *"
                                value={roomForm.name}
                                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                                placeholder="e.g., Room 101"
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField
                                fullWidth
                                label="Room Code"
                                value={roomForm.code}
                                onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
                                placeholder="e.g., R101"
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Capacity"
                                type="number"
                                value={roomForm.capacity}
                                onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 40 })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Building"
                                value={roomForm.building}
                                onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })}
                                placeholder="e.g., Main Block"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Room Type</InputLabel>
                                <Select
                                    label="Room Type"
                                    value={roomForm.room_type}
                                    onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                                >
                                    <MenuItem value="classroom">Classroom</MenuItem>
                                    <MenuItem value="lab">Laboratory</MenuItem>
                                    <MenuItem value="computer_lab">Computer Lab</MenuItem>
                                    <MenuItem value="library">Library</MenuItem>
                                    <MenuItem value="auditorium">Auditorium</MenuItem>
                                    <MenuItem value="sports">Sports Hall</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoomDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddRoom} disabled={creatingRoom}>
                        {creatingRoom ? 'Adding...' : 'Add Room'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default TimetablePage;
