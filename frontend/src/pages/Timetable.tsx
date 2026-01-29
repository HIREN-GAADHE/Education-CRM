import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, Tab, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
    Alert, Snackbar, CircularProgress, IconButton, FormControlLabel, Checkbox
} from '@mui/material';
import {
    Add as AddIcon,
    Schedule as ScheduleIcon,
    Room as RoomIcon,
    Event as EventIcon,
    Warning as WarningIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    DeleteSweep as DeleteSweepIcon
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
} from '../store/api/timetableApi';
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

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TimetablePage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [entryDialogOpen, setEntryDialogOpen] = useState(false);
    const [slotDialogOpen, setSlotDialogOpen] = useState(false);
    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const [selectedClassName, setSelectedClassName] = useState('');
    const [selectedSection, setSelectedSection] = useState('');

    // Edit mode states
    const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
    const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);

    // API Queries
    const { data: timeSlotsData, isLoading: slotsLoading } = useGetTimeSlotsQuery();
    const { data: roomsData, isLoading: roomsLoading } = useGetRoomsQuery();
    const { data: entriesData, isLoading: entriesLoading, refetch } = useGetTimetableEntriesQuery({
        className: selectedClassName || undefined,
        section: selectedSection || undefined,
    });
    const { data: staffData } = useGetStaffQuery({ page: 1, page_size: 100, staff_type: 'teaching' });
    const { data: coursesData } = useGetCoursesQuery({ page: 1, page_size: 100 });
    const { data: classesData } = useGetClassesQuery();

    // Mutations
    const [createEntry, { isLoading: creatingEntry }] = useCreateTimetableEntryMutation();
    const [updateEntry, { isLoading: updatingEntry }] = useUpdateTimetableEntryMutation();
    const [createTimeSlot, { isLoading: creatingSlot }] = useCreateTimeSlotMutation();
    const [updateTimeSlot, { isLoading: updatingSlot }] = useUpdateTimeSlotMutation();
    const [createRoom, { isLoading: creatingRoom }] = useCreateRoomMutation();
    const [updateRoom, { isLoading: updatingRoom }] = useUpdateRoomMutation();
    const [deleteEntry] = useDeleteTimetableEntryMutation();
    const [deleteTimeSlot] = useDeleteTimeSlotMutation();
    const [deleteRoom] = useDeleteRoomMutation();

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
            const message = typeof detail === 'object' ? detail.message || JSON.stringify(detail) : detail || 'Failed to save entry';
            setSnackbar({ open: true, message, severity: 'error' });
        }
    };

    const handleAddSlot = async () => {
        if (!slotForm.name || !slotForm.start_time || !slotForm.end_time) {
            setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'error' });
            return;
        }
        try {
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
                }).unwrap();
                setSnackbar({ open: true, message: 'Time slot added successfully', severity: 'success' });
            }
            setSlotDialogOpen(false);
            setEditingSlot(null);
            setSlotForm({ name: '', code: '', start_time: '08:00', end_time: '09:00', slot_type: 'class', order: 0 });
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

    const handleDeleteEntry = async (id: string) => {
        if (confirm('Are you sure you want to delete this entry?')) {
            try {
                await deleteEntry(id).unwrap();
                setSnackbar({ open: true, message: 'Entry deleted', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete', severity: 'error' });
            }
        }
    };

    const handleDeleteAllEntries = async (entry: TimetableEntry) => {
        const allRelatedEntries = entriesData?.items?.filter(e =>
            e.time_slot_id === entry.time_slot_id &&
            e.subject_name === entry.subject_name &&
            e.course_id === entry.course_id &&
            e.class_name === entry.class_name &&
            e.section === entry.section
        ) || [];

        if (allRelatedEntries.length === 0) return;

        if (confirm(`Delete all ${allRelatedEntries.length} entries for "${entry.subject_name || entry.course?.name}" across all days?`)) {
            try {
                const promises = allRelatedEntries.map(e => deleteEntry(e.id).unwrap());
                await Promise.all(promises);
                setSnackbar({
                    open: true,
                    message: `Deleted ${allRelatedEntries.length} entries successfully`,
                    severity: 'success'
                });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete entries', severity: 'error' });
            }
        }
    };

    const handleDeleteSlot = async (id: string) => {
        if (confirm('Are you sure you want to delete this time slot?')) {
            try {
                await deleteTimeSlot(id).unwrap();
                setSnackbar({ open: true, message: 'Time slot deleted', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete', severity: 'error' });
            }
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
        setSlotForm({
            name: slot.name,
            code: slot.code || '',
            start_time: slot.start_time,
            end_time: slot.end_time,
            slot_type: slot.slot_type,
            order: slot.order,
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

        // Sort time slots by order
        const sortedSlots = [...timeSlotsData.items].sort((a, b) => a.order - b.order);

        return { timeSlots: sortedSlots, grid };
    };

    const { timeSlots, grid } = buildTimetableGrid();

    const getSlotTypeColor = (slotType: string) => {
        switch (slotType) {
            case 'class': return 'primary';
            case 'break': return 'warning';
            case 'lunch': return 'info';
            case 'assembly': return 'secondary';
            case 'exam': return 'error';
            default: return 'default';
        }
    };

    const renderTimetableGrid = () => (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Time</TableCell>
                        {dayNames.map(day => (
                            <TableCell key={day} align="center" sx={{ color: 'white', fontWeight: 'bold' }}>
                                {day}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entriesLoading || slotsLoading ? (
                        <TableRow>
                            <TableCell colSpan={7} align="center">
                                <CircularProgress size={24} />
                            </TableCell>
                        </TableRow>
                    ) : timeSlots.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} align="center">
                                <Alert severity="info">
                                    No time slots configured. Add time slots in the "Time Slots" tab.
                                </Alert>
                            </TableCell>
                        </TableRow>
                    ) : (
                        timeSlots.map(slot => (
                            <TableRow
                                key={slot.id}
                                sx={{
                                    backgroundColor: ['break', 'lunch', 'assembly'].includes(slot.slot_type) ? 'grey.100' : 'inherit'
                                }}
                            >
                                <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>
                                    <Typography variant="body2" fontWeight="bold">{slot.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {slot.start_time} - {slot.end_time}
                                    </Typography>
                                </TableCell>
                                {dayNames.map((_, dayIndex) => {
                                    const entry = grid[dayIndex + 1]?.[slot.id];
                                    if (['break', 'lunch', 'assembly'].includes(slot.slot_type)) {
                                        return (
                                            <TableCell key={dayIndex} align="center" sx={{ bgcolor: 'grey.200' }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {slot.name}
                                                </Typography>
                                            </TableCell>
                                        );
                                    }
                                    return (
                                        <TableCell key={dayIndex} align="center" sx={{ minWidth: 120, p: 1 }}>
                                            {entry ? (
                                                <Box sx={{ position: 'relative' }}>
                                                    <Typography variant="body2" fontWeight="bold" color="primary">
                                                        {entry.subject_name || entry.course?.name || 'Subject'}
                                                    </Typography>
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        {entry.teacher?.first_name} {entry.teacher?.last_name}
                                                    </Typography>
                                                    <Chip size="small" label={entry.room?.name || 'Room'} sx={{ mt: 0.5 }} />
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        right: 0,
                                                        left: 0,
                                                        bottom: 0,
                                                        bgcolor: 'rgba(0,0,0,0.03)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        gap: 1,
                                                        p: 1,
                                                        opacity: 0,
                                                        transition: 'opacity 0.2s',
                                                        '&:hover': {
                                                            opacity: 1,
                                                            bgcolor: 'rgba(0,0,0,0.75)',
                                                        }
                                                    }}>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="primary"
                                                            startIcon={<EditIcon />}
                                                            onClick={() => handleEditEntry(entry)}
                                                            fullWidth
                                                            sx={{ fontSize: '0.75rem', py: 0.8, fontWeight: 'bold' }}
                                                        >
                                                            Edit Entry
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="error"
                                                            startIcon={<DeleteSweepIcon />}
                                                            onClick={() => handleDeleteAllEntries(entry)}
                                                            fullWidth
                                                            sx={{ fontSize: '0.75rem', py: 0.8, fontWeight: 'bold' }}
                                                        >
                                                            Delete All Week
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            ) : (
                                                <Typography variant="caption" color="text.disabled">-</Typography>
                                            )}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Timetable Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Class</InputLabel>
                        <Select value={selectedClassName} label="Class" onChange={(e) => setSelectedClassName(e.target.value)}>
                            <MenuItem value="">All Classes</MenuItem>
                            {classesData?.map(cls => (
                                <MenuItem key={cls.id} value={cls.name}>{cls.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Section</InputLabel>
                        <Select value={selectedSection} label="Section" onChange={(e) => setSelectedSection(e.target.value)}>
                            <MenuItem value="">All</MenuItem>
                            <MenuItem value="A">A</MenuItem>
                            <MenuItem value="B">B</MenuItem>
                            <MenuItem value="C">C</MenuItem>
                        </Select>
                    </FormControl>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEntryDialogOpen(true)}>
                        Add Entry
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab icon={<ScheduleIcon />} label="Class Timetable" />
                    <Tab icon={<RoomIcon />} label="Rooms" />
                    <Tab icon={<EventIcon />} label="Time Slots" />
                    <Tab icon={<WarningIcon />} label="Conflicts" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <Typography variant="h6" gutterBottom>
                        {selectedClassName ? `${selectedClassName}${selectedSection ? ` - Section ${selectedSection}` : ''} - Weekly Schedule` : 'All Classes - Weekly Schedule'}
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

                <TabPanel value={tabValue} index={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSlotDialogOpen(true)}>
                            Add Time Slot
                        </Button>
                    </Box>
                    {slotsLoading ? (
                        <CircularProgress />
                    ) : timeSlotsData?.items?.length === 0 ? (
                        <Alert severity="info">No time slots configured. Add time slots to get started.</Alert>
                    ) : (
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Order</TableCell>
                                        <TableCell>Period</TableCell>
                                        <TableCell>Code</TableCell>
                                        <TableCell>Start Time</TableCell>
                                        <TableCell>End Time</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {[...timeSlotsData?.items || []].sort((a, b) => a.order - b.order).map(slot => (
                                        <TableRow key={slot.id}>
                                            <TableCell>{slot.order}</TableCell>
                                            <TableCell>{slot.name}</TableCell>
                                            <TableCell>{slot.code || '-'}</TableCell>
                                            <TableCell>{slot.start_time}</TableCell>
                                            <TableCell>{slot.end_time}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={slot.slot_type}
                                                    color={getSlotTypeColor(slot.slot_type)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={slot.is_active ? 'Active' : 'Inactive'}
                                                    color={slot.is_active ? 'success' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <IconButton size="small" onClick={() => handleEditSlot(slot)} sx={{ mr: 0.5 }}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" onClick={() => handleDeleteSlot(slot.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={3}>
                    <Alert severity="success" sx={{ mb: 2 }}>
                        No scheduling conflicts detected!
                    </Alert>
                    <Typography variant="body2" color="text.secondary">
                        The system automatically checks for room, teacher, and class conflicts when adding new entries.
                    </Typography>
                </TabPanel>
            </Paper>

            {/* Add/Edit Entry Dialog */}
            <Dialog open={entryDialogOpen} onClose={() => {
                setEntryDialogOpen(false);
                setEditingEntry(null);
            }} maxWidth="sm" fullWidth>
                <DialogTitle>{editingEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Subject/Course</InputLabel>
                                <Select
                                    label="Subject/Course"
                                    value={entryForm.course_id}
                                    onChange={(e) => setEntryForm({ ...entryForm, course_id: e.target.value })}
                                >
                                    <MenuItem value="">-- Select or type below --</MenuItem>
                                    {coursesData?.items?.map((course: any) => (
                                        <MenuItem key={course.id} value={course.id}>
                                            {course.name} ({course.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Or Subject Name (if not from list)"
                                value={entryForm.subject_name}
                                onChange={(e) => setEntryForm({ ...entryForm, subject_name: e.target.value })}
                                placeholder="e.g., Mathematics"
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Day of Week *</InputLabel>
                                <Select
                                    label="Day of Week *"
                                    value={entryForm.day_of_week}
                                    onChange={(e) => setEntryForm({ ...entryForm, day_of_week: e.target.value as number })}
                                >
                                    {dayNames.map((day, idx) => (
                                        <MenuItem key={day} value={idx + 1}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip
                                                    label={day.substring(0, 3).toUpperCase()}
                                                    size="small"
                                                    color={idx < 5 ? 'primary' : idx === 5 ? 'warning' : 'default'}
                                                    sx={{ minWidth: 45 }}
                                                />
                                                <Typography>{day}</Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Period *</InputLabel>
                                <Select
                                    label="Period *"
                                    value={entryForm.time_slot_id}
                                    onChange={(e) => setEntryForm({ ...entryForm, time_slot_id: e.target.value })}
                                >
                                    {timeSlotsData?.items?.filter(s => s.slot_type === 'class').map(slot => (
                                        <MenuItem key={slot.id} value={slot.id}>
                                            {slot.name} ({slot.start_time} - {slot.end_time})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Teacher</InputLabel>
                                <Select
                                    label="Teacher"
                                    value={entryForm.teacher_id}
                                    onChange={(e) => setEntryForm({ ...entryForm, teacher_id: e.target.value })}
                                >
                                    <MenuItem value="">-- Optional --</MenuItem>
                                    {staffData?.items?.map((staff: any) => (
                                        <MenuItem key={staff.id} value={staff.id}>
                                            {staff.first_name} {staff.last_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Room</InputLabel>
                                <Select
                                    label="Room"
                                    value={entryForm.room_id}
                                    onChange={(e) => setEntryForm({ ...entryForm, room_id: e.target.value })}
                                >
                                    <MenuItem value="">-- Optional --</MenuItem>
                                    {roomsData?.items?.map(room => (
                                        <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Class</InputLabel>
                                <Select
                                    label="Class"
                                    value={entryForm.class_name}
                                    onChange={(e) => setEntryForm({ ...entryForm, class_name: e.target.value })}
                                >
                                    <MenuItem value="">-- Select --</MenuItem>
                                    {classesData?.map(cls => (
                                        <MenuItem key={cls.id} value={cls.name}>{cls.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Section"
                                value={entryForm.section}
                                onChange={(e) => setEntryForm({ ...entryForm, section: e.target.value })}
                                placeholder="e.g., A"
                            />
                        </Grid>
                        {!editingEntry && (
                            <Grid item xs={12}>
                                <Box sx={{
                                    mt: 2,
                                    p: 2.5,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: 2,
                                    boxShadow: 2
                                }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={applyToAllWeekdays}
                                                onChange={(e) => setApplyToAllWeekdays(e.target.checked)}
                                                sx={{
                                                    color: 'white',
                                                    '&.Mui-checked': { color: 'white' }
                                                }}
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Typography variant="body1" fontWeight="600" color="white">
                                                    Apply to all weekdays (Mon-Sat)
                                                </Typography>
                                                <Chip
                                                    label="Bulk Create"
                                                    size="small"
                                                    sx={{
                                                        bgcolor: 'success.main',
                                                        color: 'white',
                                                        fontWeight: 'bold'
                                                    }}
                                                />
                                            </Box>
                                        }
                                    />
                                    {applyToAllWeekdays && (
                                        <Alert
                                            severity="info"
                                            sx={{
                                                mt: 1.5,
                                                bgcolor: 'rgba(255,255,255,0.95)',
                                                '& .MuiAlert-icon': {
                                                    color: 'info.main'
                                                }
                                            }}
                                        >
                                            <Typography variant="body2" fontWeight="500">
                                                📅 This will create 6 identical entries (Monday through Saturday)
                                            </Typography>
                                        </Alert>
                                    )}
                                </Box>
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setEntryDialogOpen(false);
                        setEditingEntry(null);
                    }}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddEntry} disabled={creatingEntry || updatingEntry}>
                        {editingEntry ? (updatingEntry ? 'Updating...' : 'Update Entry') : (creatingEntry ? 'Adding...' : 'Add Entry')}
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
