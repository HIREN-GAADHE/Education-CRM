import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Chip, IconButton,
    Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemText, Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import {
    useGetEventsQuery,
    useCreateEventMutation,
    useUpdateEventMutation,
    useDeleteEventMutation,
    CalendarEvent
} from '@/store/api/calendarApi';
import { toast } from 'react-toastify';

const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [openDialog, setOpenDialog] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        event_type: 'other',
        start_datetime: '',
        end_datetime: '',
        all_day: false,
        location: '',
        color: '#1976d2',
    });

    // Get first and last day of current month for API query
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data, isLoading, error, refetch } = useGetEventsQuery({
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
    });
    const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
    const [updateEvent, { isLoading: isUpdating }] = useUpdateEventMutation();
    const [deleteEvent, { isLoading: isDeleting }] = useDeleteEventMutation();

    const eventTypes = [
        { value: 'holiday', label: 'Holiday', color: '#f44336' },
        { value: 'exam', label: 'Exam', color: '#ff9800' },
        { value: 'meeting', label: 'Meeting', color: '#2196f3' },
        { value: 'seminar', label: 'Seminar', color: '#9c27b0' },
        { value: 'sports', label: 'Sports', color: '#4caf50' },
        { value: 'cultural', label: 'Cultural', color: '#e91e63' },
        { value: 'workshop', label: 'Workshop', color: '#00bcd4' },
        { value: 'other', label: 'Other', color: '#607d8b' },
    ];

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleOpenCreate = (date?: Date) => {
        setEditingEvent(null);
        const d = date || new Date();
        const dateStr = d.toISOString().slice(0, 16);
        setFormData({
            title: '',
            description: '',
            event_type: 'other',
            start_datetime: dateStr,
            end_datetime: dateStr,
            all_day: false,
            location: '',
            color: '#1976d2',
        });
        setOpenDialog(true);
    };

    const handleOpenEdit = (event: CalendarEvent) => {
        setEditingEvent(event);
        setFormData({
            title: event.title,
            description: event.description || '',
            event_type: event.event_type,
            start_datetime: event.start_datetime.slice(0, 16),
            end_datetime: event.end_datetime.slice(0, 16),
            all_day: event.all_day,
            location: event.location || '',
            color: event.color,
        });
        setOpenDialog(true);
    };

    const handleSubmit = async () => {
        try {
            const payload = {
                ...formData,
                start_datetime: new Date(formData.start_datetime).toISOString(),
                end_datetime: new Date(formData.end_datetime).toISOString(),
            };
            if (editingEvent) {
                await updateEvent({ id: editingEvent.id, data: payload }).unwrap();
                toast.success('Event updated!');
            } else {
                await createEvent(payload).unwrap();
                toast.success('Event created!');
            }
            setOpenDialog(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteEvent(id).unwrap();
            toast.success('Event deleted!');
            setDeleteConfirm(null);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    // Generate calendar days
    const generateCalendarDays = () => {
        const days = [];
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const startDay = firstDayOfMonth.getDay();

        // Add empty cells for days before the first day
        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
        }

        return days;
    };

    const getEventsForDate = (date: Date) => {
        if (!data?.items) return [];
        return data.items.filter(event => {
            const eventDate = new Date(event.start_datetime);
            // Debug matching
            // console.log(`Checking ${event.title}: ${eventDate.toDateString()} === ${date.toDateString()}`);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Calendar
                    </Typography>
                    <Typography color="text.secondary">
                        Manage events, holidays, and schedules
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCreate()} sx={{ borderRadius: 3 }}>
                    Add Event
                </Button>
            </Box>

            {/* Calendar Navigation */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <IconButton onClick={handlePrevMonth}><ChevronLeftIcon /></IconButton>
                    <Typography variant="h5" fontWeight="bold">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </Typography>
                    <IconButton onClick={handleNextMonth}><ChevronRightIcon /></IconButton>
                </Box>
            </Card>

            {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load events.</Alert>}

            {/* Calendar Grid */}
            {!isLoading && (
                <Card>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {/* Day Headers */}
                        {dayNames.map(day => (
                            <Box key={day} sx={{ p: 1, textAlign: 'center', fontWeight: 'bold', bgcolor: 'action.hover' }}>
                                {day}
                            </Box>
                        ))}

                        {/* Calendar Days */}
                        {generateCalendarDays().map((day, index) => (
                            <Box
                                key={index}
                                onClick={() => day && handleOpenCreate(day)}
                                sx={{
                                    minHeight: 100,
                                    p: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: day ? 'pointer' : 'default',
                                    bgcolor: day?.toDateString() === new Date().toDateString() ? 'primary.main' : 'transparent',
                                    color: day?.toDateString() === new Date().toDateString() ? 'primary.contrastText' : 'inherit',
                                    '&:hover': day ? { bgcolor: 'action.hover' } : {},
                                }}
                            >
                                {day && (
                                    <>
                                        <Typography variant="body2" fontWeight={600}>{day.getDate()}</Typography>
                                        {getEventsForDate(day).slice(0, 3).map(event => (
                                            <Chip
                                                key={event.id}
                                                label={event.title}
                                                size="small"
                                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }}
                                                sx={{
                                                    mt: 0.5,
                                                    width: '100%',
                                                    justifyContent: 'flex-start',
                                                    bgcolor: event.color,
                                                    color: 'white',
                                                    fontSize: '0.7rem',
                                                    height: 20,
                                                }}
                                            />
                                        ))}
                                        {getEventsForDate(day).length > 3 && (
                                            <Typography variant="caption" color="text.secondary">
                                                +{getEventsForDate(day).length - 3} more
                                            </Typography>
                                        )}
                                    </>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Card>
            )}

            {/* Upcoming Events */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Upcoming Events</Typography>
                    <List>
                        {data?.items.slice(0, 5).map((event, index) => (
                            <React.Fragment key={event.id}>
                                <ListItem
                                    secondaryAction={
                                        <>
                                            <IconButton size="small" onClick={() => handleOpenEdit(event)}><EditIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" onClick={() => setDeleteConfirm(event.id)}><DeleteIcon fontSize="small" /></IconButton>
                                        </>
                                    }
                                >
                                    <Box sx={{ width: 4, height: 40, bgcolor: event.color, borderRadius: 1, mr: 2 }} />
                                    <ListItemText
                                        primary={event.title}
                                        secondary={`${new Date(event.start_datetime).toLocaleDateString()} - ${event.event_type}`}
                                    />
                                </ListItem>
                                {index < 4 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingEvent ? 'Edit Event' : 'Create Event'}
                    <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField fullWidth label="Title *" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                        <TextField fullWidth label="Description" multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                        <FormControl fullWidth>
                            <InputLabel>Event Type</InputLabel>
                            <Select value={formData.event_type} label="Event Type" onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}>
                                {eventTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField fullWidth label="Start Date & Time" type="datetime-local" value={formData.start_datetime} onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })} InputLabelProps={{ shrink: true }} />
                        <TextField fullWidth label="End Date & Time" type="datetime-local" value={formData.end_datetime} onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })} InputLabelProps={{ shrink: true }} />
                        <TextField fullWidth label="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                        <TextField fullWidth label="Color" type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={isCreating || isUpdating || !formData.title}>
                        {isCreating || isUpdating ? <CircularProgress size={24} /> : editingEvent ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent><Typography>Delete this event?</Typography></DialogContent>
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

export default CalendarPage;
