import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box, Typography, Tabs, Tab, Grid, Card, CardContent, CardActions,
    Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, CircularProgress, Alert, Collapse, IconButton,
    Paper, Divider, alpha, useTheme, Tooltip,
} from '@mui/material';
import {
    CalendarMonth, AccessTime, VideoCall, CheckCircle, Cancel,
    Add, Delete, ExpandMore, ExpandLess, Send, MeetingRoom,
    EventAvailable,
} from '@mui/icons-material';
import {
    useGetPTMSlotsQuery,
    useCreatePTMSlotMutation,
    useDeletePTMSlotMutation,
    useGetPTMSessionsQuery,
    useBookPTMSessionMutation,
    useUpdatePTMSessionStatusMutation,
    useGetPTMRemarksQuery,
    useAddPTMRemarkMutation,
    PTMSession,
    PTMSlot,
} from '../../store/api/ptmApi';
import { useGetStudentsQuery } from '../../store/api/studentApi';
import { selectRoleLevel } from '../../store/slices/authSlice';
import { toast } from 'react-toastify';

export default function PTMScheduling() {
    const [tab, setTab] = useState(0);
    const roleLevel = useSelector(selectRoleLevel);
    const isTeacherOrAdmin = roleLevel !== null && roleLevel <= 6;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{
                    p: 1.5, borderRadius: 2,
                    background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                }}>
                    <MeetingRoom sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Parent-Teacher Meetings</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Schedule and manage parent-teacher meeting slots
                    </Typography>
                </Box>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                >
                    <Tab icon={<EventAvailable />} iconPosition="start" label="Available Slots" />
                    <Tab icon={<CalendarMonth />} iconPosition="start" label="My Meetings" />
                    {isTeacherOrAdmin && <Tab icon={<Add />} iconPosition="start" label="Manage Slots" />}
                </Tabs>

                <Box sx={{ p: 3 }}>
                    {tab === 0 && <AvailableSlotsTab />}
                    {tab === 1 && <MyMeetingsTab isTeacher={isTeacherOrAdmin} />}
                    {tab === 2 && isTeacherOrAdmin && <ManageSlotsTab />}
                </Box>
            </Paper>
        </Box>
    );
}

// ─── Tab 1: Available Slots ───────────────────────────────────────────────────
function AvailableSlotsTab() {
    const theme = useTheme();
    const [filterDate, setFilterDate] = useState('');
    const [bookingSlot, setBookingSlot] = useState<PTMSlot | null>(null);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [reason, setReason] = useState('');

    const { data: slotsData, isLoading } = useGetPTMSlotsQuery({
        available_only: true,
        ...(filterDate ? { date: filterDate } : {}),
    });
    const { data: studentsData } = useGetStudentsQuery({ page_size: 100 } as any);
    const [bookSession, { isLoading: isBooking }] = useBookPTMSessionMutation();

    const handleBook = async () => {
        if (!bookingSlot || !selectedStudent) return;
        try {
            await bookSession({ slot_id: bookingSlot.id, student_id: selectedStudent, reason }).unwrap();
            toast.success('Meeting booked! Check "My Meetings" for the link.');
            setBookingSlot(null);
            setSelectedStudent('');
            setReason('');
        } catch {
            toast.error('Failed to book the meeting. Please try again.');
        }
    };

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;
    const slots = slotsData?.items ?? [];

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                <TextField
                    type="date" label="Filter by Date" size="small"
                    value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ width: 200 }}
                />
                {filterDate && <Button size="small" onClick={() => setFilterDate('')}>Clear</Button>}
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                    {slots.length} slot{slots.length !== 1 ? 's' : ''} available
                </Typography>
            </Box>

            {slots.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No available slots{filterDate ? ' on this date' : ''}. Check back later or contact the school office.
                </Alert>
            ) : (
                <Grid container spacing={2}>
                    {slots.map((slot) => (
                        <Grid item xs={12} sm={6} md={4} key={slot.id}>
                            <Card elevation={0} sx={{
                                border: '1px solid', borderColor: 'divider', borderRadius: 3,
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: 'primary.main', boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.15)}` }
                            }}>
                                <CardContent sx={{ pb: 1 }}>
                                    <Chip label="Available" color="success" size="small" icon={<CheckCircle />} sx={{ mb: 1.5 }} />
                                    <Typography variant="subtitle1" fontWeight={700}>
                                        {slot.teacher ? `${slot.teacher.first_name} ${slot.teacher.last_name}` : 'Teacher'}
                                    </Typography>
                                    {slot.teacher?.designation && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {slot.teacher.designation}
                                        </Typography>
                                    )}
                                    <Divider sx={{ my: 1.5 }} />
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <CalendarMonth fontSize="small" color="action" />
                                        <Typography variant="body2">
                                            {new Date(slot.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccessTime fontSize="small" color="action" />
                                        <Typography variant="body2">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</Typography>
                                    </Box>
                                    {slot.notes && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                            📝 {slot.notes}
                                        </Typography>
                                    )}
                                </CardContent>
                                <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
                                    <Button fullWidth variant="contained" size="small"
                                        onClick={() => setBookingSlot(slot)}
                                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                                        Book this Slot
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Dialog open={!!bookingSlot} onClose={() => setBookingSlot(null)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Confirm Booking</DialogTitle>
                <DialogContent>
                    {bookingSlot && (
                        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                            <Typography variant="body2" color="text.secondary">Teacher</Typography>
                            <Typography fontWeight={600}>
                                {bookingSlot.teacher ? `${bookingSlot.teacher.first_name} ${bookingSlot.teacher.last_name}` : '—'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Date & Time</Typography>
                            <Typography fontWeight={600}>
                                {new Date(bookingSlot.date).toLocaleDateString()} · {bookingSlot.start_time.slice(0, 5)} – {bookingSlot.end_time.slice(0, 5)}
                            </Typography>
                        </Box>
                    )}
                    <TextField select fullWidth label="Select Student" size="small"
                        value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} sx={{ mb: 2 }}>
                        {((studentsData as any)?.items ?? []).map((s: any) => (
                            <MenuItem key={s.id} value={s.id}>
                                {s.first_name} {s.last_name} ({s.admission_number})
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField fullWidth multiline rows={2} label="Reason (optional)" size="small"
                        value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Academic performance discussion" />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setBookingSlot(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleBook}
                        disabled={isBooking || !selectedStudent}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isBooking ? 'Booking…' : 'Confirm Booking'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ─── Tab 2: My Meetings ───────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
    scheduled: 'info', requested: 'warning', completed: 'success', cancelled: 'error',
};

function MyMeetingsTab({ isTeacher }: { isTeacher: boolean }) {
    const { data, isLoading } = useGetPTMSessionsQuery({});
    const sessions = data?.items ?? [];

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;
    if (sessions.length === 0) {
        return (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
                No meetings yet. {!isTeacher && 'Go to "Available Slots" to book one.'}
            </Alert>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sessions.map((session) => (
                <SessionCard key={session.id} session={session} isTeacher={isTeacher} />
            ))}
        </Box>
    );
}

function SessionCard({ session, isTeacher }: { session: PTMSession; isTeacher: boolean }) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [remarkText, setRemarkText] = useState('');
    const [updateStatus] = useUpdatePTMSessionStatusMutation();
    const [addRemark, { isLoading: isAddingRemark }] = useAddPTMRemarkMutation();
    const { data: remarks } = useGetPTMRemarksQuery(session.id, { skip: !expanded });

    const handleStatusChange = async (newStatus: string) => {
        try {
            await updateStatus({ id: session.id, status: newStatus }).unwrap();
            toast.success(`Meeting marked as ${newStatus}`);
        } catch { toast.error('Failed to update status'); }
    };

    const handleAddRemark = async () => {
        if (!remarkText.trim()) return;
        try {
            await addRemark({ sessionId: session.id, content: remarkText }).unwrap();
            toast.success('Remark added');
            setRemarkText('');
        } catch { toast.error('Failed to add remark'); }
    };

    return (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                            {session.teacher ? `${session.teacher.first_name} ${session.teacher.last_name}` : 'Teacher'}
                            {session.teacher?.designation && (
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    ({session.teacher.designation})
                                </Typography>
                            )}
                        </Typography>
                        {session.student && (
                            <Typography variant="body2" color="text.secondary">
                                Student: {session.student.first_name} {session.student.last_name} · {session.student.admission_number}
                            </Typography>
                        )}
                        {session.scheduled_at && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <AccessTime fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                    {new Date(session.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {session.duration_minutes} min
                                </Typography>
                            </Box>
                        )}
                        {session.reason && (
                            <Typography variant="caption" color="text.secondary">Reason: {session.reason}</Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Chip label={session.status.toUpperCase()} color={STATUS_COLOR[session.status] || 'default'}
                            size="small" sx={{ fontWeight: 700 }} />
                        {session.meeting_link && session.status !== 'cancelled' && (
                            <Tooltip title="Join Meeting">
                                <Button variant="contained" size="small" color="success"
                                    startIcon={<VideoCall />}
                                    href={session.meeting_link} target="_blank"
                                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                                    Join
                                </Button>
                            </Tooltip>
                        )}
                    </Box>
                </Box>

                {isTeacher && session.status === 'scheduled' && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button size="small" variant="outlined" color="success" startIcon={<CheckCircle />}
                            onClick={() => handleStatusChange('completed')}
                            sx={{ borderRadius: 2, textTransform: 'none' }}>
                            Mark Completed
                        </Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<Cancel />}
                            onClick={() => handleStatusChange('cancelled')}
                            sx={{ borderRadius: 2, textTransform: 'none' }}>
                            Cancel
                        </Button>
                    </Box>
                )}
            </CardContent>

            <Divider />
            <Box sx={{ px: 2, py: 1 }}>
                <Button size="small" onClick={() => setExpanded(!expanded)}
                    endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: 'text.secondary' }}>
                    {expanded ? 'Hide' : 'Show'} Remarks {remarks && remarks.length > 0 && `(${remarks.length})`}
                </Button>
            </Box>

            <Collapse in={expanded}>
                <Box sx={{ px: 2, pb: 2 }}>
                    {remarks && remarks.length > 0 ? (
                        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {remarks.map((r) => (
                                <Box key={r.id} sx={{
                                    p: 1.5, borderRadius: 2,
                                    bgcolor: r.author_type === 'teacher'
                                        ? alpha(theme.palette.primary.main, 0.07)
                                        : alpha(theme.palette.secondary.main, 0.07),
                                }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Chip label={r.author_type.toUpperCase()} size="small"
                                            color={r.author_type === 'teacher' ? 'primary' : 'secondary'}
                                            sx={{ fontSize: '0.65rem', height: 20 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(r.created_at).toLocaleString()}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2">{r.content}</Typography>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No remarks yet.</Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField fullWidth size="small" placeholder="Add a remark…"
                            value={remarkText} onChange={(e) => setRemarkText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddRemark(); } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        <IconButton color="primary" onClick={handleAddRemark}
                            disabled={isAddingRemark || !remarkText.trim()}>
                            <Send />
                        </IconButton>
                    </Box>
                </Box>
            </Collapse>
        </Card>
    );
}

// ─── Tab 3: Manage Slots (teacher/admin) ──────────────────────────────────────
function ManageSlotsTab() {
    const { data, isLoading } = useGetPTMSlotsQuery({});
    const [createSlot, { isLoading: isCreating }] = useCreatePTMSlotMutation();
    const [deleteSlot] = useDeletePTMSlotMutation();
    const [openDialog, setOpenDialog] = useState(false);
    const [form, setForm] = useState({ date: '', start_time: '', end_time: '', notes: '' });

    const handleCreate = async () => {
        if (!form.date || !form.start_time || !form.end_time) {
            toast.error('Please fill in date and both times');
            return;
        }
        try {
            await createSlot(form).unwrap();
            toast.success('Slot created successfully');
            setOpenDialog(false);
            setForm({ date: '', start_time: '', end_time: '', notes: '' });
        } catch { toast.error('Failed to create slot'); }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteSlot(id).unwrap();
            toast.success('Slot deleted');
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Cannot delete a booked slot');
        }
    };

    const slots = data?.items ?? [];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    Add Available Slot
                </Button>
            </Box>

            {isLoading ? (
                <Box textAlign="center" py={6}><CircularProgress /></Box>
            ) : slots.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No slots yet. Click "Add Available Slot" to create your first one.
                </Alert>
            ) : (
                <Grid container spacing={2}>
                    {slots.map((slot) => (
                        <Grid item xs={12} sm={6} md={4} key={slot.id}>
                            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                                <CardContent sx={{ pb: 1 }}>
                                    <Chip size="small" label={slot.is_booked ? 'Booked' : 'Available'}
                                        color={slot.is_booked ? 'warning' : 'success'} sx={{ mb: 1 }} />
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <CalendarMonth fontSize="small" color="action" />
                                        <Typography variant="body2" fontWeight={600}>
                                            {new Date(slot.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccessTime fontSize="small" color="action" />
                                        <Typography variant="body2">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</Typography>
                                    </Box>
                                    {slot.notes && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>{slot.notes}</Typography>
                                    )}
                                </CardContent>
                                {!slot.is_booked && (
                                    <CardActions sx={{ pt: 0 }}>
                                        <Button size="small" color="error" startIcon={<Delete />}
                                            onClick={() => handleDelete(slot.id)}
                                            sx={{ textTransform: 'none' }}>
                                            Delete
                                        </Button>
                                    </CardActions>
                                )}
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Add Available Slot</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        <TextField label="Date" type="date" size="small" fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                            inputProps={{ min: new Date().toISOString().split('T')[0] }} />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField label="Start Time" type="time" size="small" fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                            <TextField label="End Time" type="time" size="small" fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                        </Box>
                        <TextField label="Notes (optional)" size="small" fullWidth multiline rows={2}
                            placeholder="e.g. Online meeting via Google Meet"
                            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreate} disabled={isCreating}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isCreating ? 'Creating…' : 'Create Slot'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
