import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box, Typography, Tabs, Tab, Grid, Card, CardContent, CardActions,
    Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, CircularProgress, Alert, Paper, Divider,
    alpha, useTheme, Autocomplete, LinearProgress, Tooltip,
} from '@mui/material';
import {
    MenuBook, Add, CheckCircle, Mood, MoodBad, SentimentNeutral,
    SentimentVeryDissatisfied, SentimentVerySatisfied, Psychology,
    ThumbUp, Check,
} from '@mui/icons-material';
import {
    useGetDiaryEntriesQuery, useCreateDiaryEntryMutation,
    useAcknowledgeDiaryEntryMutation, useGetMoodSummaryQuery,
    DiaryEntry, MoodType,
} from '../../store/api/dailyDiaryApi';
import { useGetAllStudentsQuery } from '../../store/api/studentApi';
import { selectRoleLevel } from '../../store/slices/authSlice';
import { toast } from 'react-toastify';

const MOODS: { value: MoodType; label: string; emoji: string; color: string }[] = [
    { value: 'happy', label: 'Happy', emoji: '😊', color: '#48BB78' },
    { value: 'excited', label: 'Excited', emoji: '🤩', color: '#ED8936' },
    { value: 'neutral', label: 'Neutral', emoji: '😐', color: '#718096' },
    { value: 'anxious', label: 'Anxious', emoji: '😰', color: '#ECC94B' },
    { value: 'sad', label: 'Sad', emoji: '😢', color: '#4299E1' },
    { value: 'angry', label: 'Angry', emoji: '😠', color: '#FC8181' },
];
const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.value, m]));
const HOMEWORK_STATUSES = ['completed', 'incomplete', 'partial', 'not_assigned'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'half_day'];

export default function DailyDiaryPage() {
    const [tab, setTab] = useState(0);
    const roleLevel = useSelector(selectRoleLevel);
    const isTeacher = roleLevel !== null && roleLevel <= 6;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{
                    p: 1.5, borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                }}>
                    <MenuBook sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Daily Diary</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isTeacher ? 'Record student mood, behavior & academic updates' : "View your child's daily diary entries"}
                    </Typography>
                </Box>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}
                    sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Tab icon={<MenuBook />} iconPosition="start" label="All Entries" />
                    {isTeacher && <Tab icon={<Add />} iconPosition="start" label="New Entry" />}
                </Tabs>
                <Box sx={{ p: 3 }}>
                    {tab === 0 && <AllEntriesTab isTeacher={isTeacher} />}
                    {tab === 1 && isTeacher && <NewEntryTab onSuccess={() => setTab(0)} />}
                </Box>
            </Paper>
        </Box>
    );
}

// ─── All Entries ───────────────────────────────────────────────────────────────
function AllEntriesTab({ isTeacher }: { isTeacher: boolean }) {
    const theme = useTheme();
    const [studentFilter, setStudentFilter] = useState<string | undefined>();
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { data, isLoading } = useGetDiaryEntriesQuery({
        ...(studentFilter ? { student_id: studentFilter } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
    });
    const { data: students = [] } = useGetAllStudentsQuery();
    const [acknowledge] = useAcknowledgeDiaryEntryMutation();

    const handleAcknowledge = async (id: string) => {
        try { await acknowledge(id).unwrap(); toast.success('Entry acknowledged'); }
        catch { toast.error('Failed to acknowledge'); }
    };

    const entries = data?.items ?? [];

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {isTeacher && (
                    <Autocomplete
                        options={students}
                        getOptionLabel={(s: any) => `${s.first_name} ${s.last_name} (${s.admission_number})`}
                        onChange={(_, v) => setStudentFilter(v?.id)}
                        renderInput={(p) => <TextField {...p} label="Filter by Student" size="small" sx={{ width: 280 }} />}
                        size="small"
                    />
                )}
                <TextField type="date" label="From" size="small" InputLabelProps={{ shrink: true }}
                    value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <TextField type="date" label="To" size="small" InputLabelProps={{ shrink: true }}
                    value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                {(studentFilter || dateFrom || dateTo) && (
                    <Button size="small" onClick={() => { setStudentFilter(undefined); setDateFrom(''); setDateTo(''); }}>Clear</Button>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                    {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
                </Typography>
            </Box>

            {entries.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No diary entries found.</Alert>
            ) : (
                <Grid container spacing={2}>
                    {entries.map((entry) => (
                        <Grid item xs={12} md={6} key={entry.id}>
                            <DiaryCard entry={entry} isTeacher={isTeacher} onAcknowledge={handleAcknowledge} />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}

function DiaryCard({ entry, isTeacher, onAcknowledge }: {
    entry: DiaryEntry; isTeacher: boolean; onAcknowledge: (id: string) => void;
}) {
    const theme = useTheme();
    const mood = entry.mood ? MOOD_MAP[entry.mood] : null;

    return (
        <Card elevation={0} sx={{
            border: '1px solid', borderColor: 'divider', borderRadius: 3,
            borderLeft: mood ? `4px solid ${mood.color}` : undefined,
        }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Box>
                        {entry.student && (
                            <Typography variant="subtitle2" fontWeight={700}>
                                {entry.student.first_name} {entry.student.last_name}
                            </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                            {new Date(entry.entry_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {mood && (
                            <Tooltip title={mood.label}>
                                <Typography fontSize={28} lineHeight={1}>{mood.emoji}</Typography>
                            </Tooltip>
                        )}
                        {entry.behavior_score !== undefined && entry.behavior_score !== null && (
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" fontWeight={800} color={entry.behavior_score >= 4 ? 'success.main' : entry.behavior_score <= 2 ? 'error.main' : 'text.primary'}>
                                    {entry.behavior_score}/5
                                </Typography>
                                <Typography variant="caption" color="text.secondary">Behavior</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    {entry.attendance_status && (
                        <Chip label={entry.attendance_status} size="small"
                            color={entry.attendance_status === 'present' ? 'success' : entry.attendance_status === 'absent' ? 'error' : 'warning'}
                        />
                    )}
                    {entry.homework_status && (
                        <Chip label={`HW: ${entry.homework_status}`} size="small"
                            color={entry.homework_status === 'completed' ? 'success' : entry.homework_status === 'incomplete' ? 'error' : 'default'}
                        />
                    )}
                    {entry.is_shared_with_parent && (
                        <Chip label={entry.parent_acknowledged ? '✓ Acknowledged' : 'Shared'} size="small"
                            color={entry.parent_acknowledged ? 'success' : 'info'} variant="outlined" />
                    )}
                </Box>

                {entry.academic_notes && (
                    <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Academic</Typography>
                        <Typography variant="body2" sx={{ mt: 0.25 }}>{entry.academic_notes}</Typography>
                    </Box>
                )}
                {entry.behavior_notes && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Behavior</Typography>
                        <Typography variant="body2" sx={{ mt: 0.25 }}>{entry.behavior_notes}</Typography>
                    </Box>
                )}
            </CardContent>
            {!isTeacher && entry.is_shared_with_parent && !entry.parent_acknowledged && (
                <CardActions sx={{ pt: 0 }}>
                    <Button size="small" startIcon={<ThumbUp />} onClick={() => onAcknowledge(entry.id)}
                        sx={{ textTransform: 'none' }}>
                        Mark as Read
                    </Button>
                </CardActions>
            )}
        </Card>
    );
}

// ─── New Entry ─────────────────────────────────────────────────────────────────
function NewEntryTab({ onSuccess }: { onSuccess: () => void }) {
    const { data: students = [] } = useGetAllStudentsQuery();
    const [createEntry, { isLoading }] = useCreateDiaryEntryMutation();

    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState<any>({
        entry_date: today,
        mood: '',
        behavior_score: '',
        attendance_status: 'present',
        homework_status: '',
        is_shared_with_parent: true,
    });
    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    const handleSubmit = async () => {
        if (!selectedStudent) { toast.error('Please select a student'); return; }
        try {
            await createEntry({
                ...form,
                student_id: selectedStudent.id,
                behavior_score: form.behavior_score ? parseInt(form.behavior_score) : undefined,
            }).unwrap();
            toast.success('Diary entry saved!');
            onSuccess();
        } catch { toast.error('Failed to save entry'); }
    };

    return (
        <Box sx={{ maxWidth: 680 }}>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                    <Autocomplete
                        options={students}
                        getOptionLabel={(s: any) => `${s.first_name} ${s.last_name} (${s.admission_number})`}
                        value={selectedStudent}
                        onChange={(_, v) => setSelectedStudent(v)}
                        renderInput={(p) => <TextField {...p} label="Student *" size="small" />}
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <TextField fullWidth type="date" label="Date" size="small" InputLabelProps={{ shrink: true }}
                        value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                </Grid>

                {/* Mood picker */}
                <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
                        MOOD
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {MOODS.map((m) => (
                            <Chip
                                key={m.value}
                                label={`${m.emoji} ${m.label}`}
                                onClick={() => setForm({ ...form, mood: form.mood === m.value ? '' : m.value })}
                                variant={form.mood === m.value ? 'filled' : 'outlined'}
                                sx={{
                                    cursor: 'pointer', fontWeight: 600,
                                    ...(form.mood === m.value ? { bgcolor: m.color, color: 'white', borderColor: m.color } : {}),
                                }}
                            />
                        ))}
                    </Box>
                </Grid>

                {/* Behavior score */}
                <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Behavior Score (1–5)" size="small"
                        value={form.behavior_score} onChange={(e) => setForm({ ...form, behavior_score: e.target.value })}>
                        <MenuItem value="">—</MenuItem>
                        {[1, 2, 3, 4, 5].map((s) => <MenuItem key={s} value={s}>{s} — {['Poor', 'Below Average', 'Average', 'Good', 'Excellent'][s - 1]}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Attendance" size="small"
                        value={form.attendance_status} onChange={(e) => setForm({ ...form, attendance_status: e.target.value })}>
                        {ATTENDANCE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Homework Status" size="small"
                        value={form.homework_status} onChange={(e) => setForm({ ...form, homework_status: e.target.value })}>
                        <MenuItem value="">—</MenuItem>
                        {HOMEWORK_STATUSES.map((s) => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</MenuItem>)}
                    </TextField>
                </Grid>

                <Grid item xs={12}>
                    <TextField fullWidth label="Academic Notes" size="small" multiline rows={3}
                        placeholder="Classwork participation, performance, topics covered…"
                        value={form.academic_notes || ''} onChange={(e) => setForm({ ...form, academic_notes: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                    <TextField fullWidth label="Behavior Notes" size="small" multiline rows={3}
                        placeholder="Conduct, incidents, positive highlights…"
                        value={form.behavior_notes || ''} onChange={(e) => setForm({ ...form, behavior_notes: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                    <TextField fullWidth label="Homework Notes" size="small"
                        placeholder="Details about the homework assigned or quality…"
                        value={form.homework_notes || ''} onChange={(e) => setForm({ ...form, homework_notes: e.target.value })} />
                </Grid>

                <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            label={form.is_shared_with_parent ? 'Visible to Parents ✓' : 'Hidden from Parents'}
                            onClick={() => setForm({ ...form, is_shared_with_parent: !form.is_shared_with_parent })}
                            color={form.is_shared_with_parent ? 'success' : 'default'}
                            variant={form.is_shared_with_parent ? 'filled' : 'outlined'}
                            sx={{ cursor: 'pointer' }}
                        />
                    </Box>
                </Grid>

                <Grid item xs={12}>
                    <Button variant="contained" onClick={handleSubmit} disabled={isLoading || !selectedStudent}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 4 }}>
                        {isLoading ? 'Saving…' : 'Save Entry'}
                    </Button>
                </Grid>
            </Grid>
        </Box>
    );
}
