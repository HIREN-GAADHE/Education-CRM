import { useState } from 'react';
import {
    Box, Typography, Tabs, Tab, Grid, Card, CardContent, CardActions,
    Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, CircularProgress, Alert, Paper, Divider,
    Autocomplete,
} from '@mui/material';
import {
    HealthAndSafety, Vaccines, LocalHospital, Edit, Add, Delete,
    PersonSearch, Warning, CheckCircle, Home,
} from '@mui/icons-material';
import {
    useGetHealthRecordQuery, useUpsertHealthRecordMutation,
    useGetNurseVisitsQuery, useLogNurseVisitMutation, useDeleteNurseVisitMutation,
    useGetVaccinationsQuery, useAddVaccinationMutation, useDeleteVaccinationMutation,
} from '../../store/api/healthApi';
import { useGetAllStudentsQuery } from '../../store/api/studentApi';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { selectRoleLevel } from '../../store/slices/authSlice';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VAX_STATUSES = ['completed', 'pending', 'scheduled', 'exempted'];
const STATUS_COLORS: Record<string, any> = {
    completed: 'success', pending: 'warning', scheduled: 'info', exempted: 'default'
};

export default function HealthRecords() {
    const [tab, setTab] = useState(0);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const roleLevel = useSelector(selectRoleLevel);
    const canEdit = roleLevel !== null && roleLevel <= 6;

    const { data: students = [] } = useGetAllStudentsQuery();
    const studentOptions = students.map((s) => ({
        id: s.id,
        label: `${s.first_name} ${s.last_name} (${s.admission_number})`,
    }));

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{
                    p: 1.5, borderRadius: 2,
                    background: (_t) => `linear-gradient(135deg, #e53e3e, #dd6b20)`,
                }}>
                    <HealthAndSafety sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Student Health Records</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Medical history, nurse visits & vaccination records
                    </Typography>
                </Box>
            </Box>

            {/* Student selector */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Autocomplete
                    options={studentOptions}
                    getOptionLabel={(o) => o.label}
                    value={studentOptions.find((o: any) => o.id === selectedStudentId) || null}
                    onChange={(_, newValue) => setSelectedStudentId(newValue?.id ?? null)}
                    renderInput={(params) => (
                        <TextField {...params} label="Search Student" placeholder="Type name or admission number…"
                            InputProps={{ ...params.InputProps, startAdornment: <PersonSearch color="action" sx={{ mr: 1 }} /> }}
                        />
                    )}
                    sx={{ maxWidth: 480 }}
                />
            </Paper>

            {!selectedStudentId ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Select a student above to view or edit their health records.
                </Alert>
            ) : (
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)}
                        sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Tab icon={<HealthAndSafety />} iconPosition="start" label="Overview" />
                        <Tab icon={<LocalHospital />} iconPosition="start" label="Nurse Visits" />
                        <Tab icon={<Vaccines />} iconPosition="start" label="Vaccinations" />
                    </Tabs>
                    <Box sx={{ p: 3 }}>
                        {tab === 0 && <OverviewTab studentId={selectedStudentId} canEdit={canEdit} />}
                        {tab === 1 && <NurseVisitsTab studentId={selectedStudentId} canEdit={canEdit} />}
                        {tab === 2 && <VaccinationsTab studentId={selectedStudentId} canEdit={canEdit} />}
                    </Box>
                </Paper>
            )}
        </Box>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
    const { data: record, isLoading, error } = useGetHealthRecordQuery(studentId);
    const [upsert, { isLoading: isSaving }] = useUpsertHealthRecordMutation();
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<any>({});

    const startEdit = () => {
        setForm(record ? { ...record } : {});
        setEditing(true);
    };

    const handleSave = async () => {
        try {
            await upsert({ studentId, data: form }).unwrap();
            toast.success('Health record saved');
            setEditing(false);
        } catch { toast.error('Failed to save health record'); }
    };

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    if (error && !record) {
        return (
            <Box>
                <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
                    No health record on file yet.
                </Alert>
                {canEdit && (
                    <Button variant="contained" startIcon={<Add />} onClick={() => { setForm({}); setEditing(true); }}
                        sx={{ borderRadius: 2, textTransform: 'none' }}>
                        Create Health Record
                    </Button>
                )}
            </Box>
        );
    }

    const Section = ({ title, children }: any) => (
        <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={700}>{title}</Typography>
            <Divider sx={{ mb: 1.5 }} />
            <Grid container spacing={2}>{children}</Grid>
        </Box>
    );

    const InfoItem = ({ label, value }: any) => (
        <Grid item xs={12} sm={6} md={4}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
        </Grid>
    );

    return (
        <Box>
            {record && (
                <>
                    <Section title="Vitals">
                        <InfoItem label="Blood Group" value={record.blood_group} />
                        <InfoItem label="Height" value={record.height_cm ? `${record.height_cm} cm` : null} />
                        <InfoItem label="Weight" value={record.weight_kg ? `${record.weight_kg} kg` : null} />
                        <InfoItem label="Vision (Left)" value={record.vision_left} />
                        <InfoItem label="Vision (Right)" value={record.vision_right} />
                    </Section>
                    <Section title="Medical Information">
                        <InfoItem label="Allergies" value={record.allergies} />
                        <InfoItem label="Chronic Conditions" value={record.chronic_conditions} />
                        <InfoItem label="Current Medications" value={record.current_medications} />
                        <InfoItem label="Dietary Restrictions" value={record.dietary_restrictions} />
                        <InfoItem label="Special Needs" value={record.special_needs} />
                    </Section>
                    <Section title="Emergency Contact">
                        <InfoItem label="Name" value={record.emergency_contact_name} />
                        <InfoItem label="Phone" value={record.emergency_contact_phone} />
                        <InfoItem label="Relation" value={record.emergency_contact_relation} />
                        <InfoItem label="Family Doctor" value={record.family_doctor_name} />
                        <InfoItem label="Doctor Phone" value={record.family_doctor_phone} />
                    </Section>
                    {record.notes && (
                        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
                            <Typography variant="body2"><strong>Notes:</strong> {record.notes}</Typography>
                        </Alert>
                    )}
                </>
            )}
            {canEdit && (
                <Box sx={{ mt: 2 }}>
                    <Button variant="outlined" startIcon={<Edit />} onClick={startEdit}
                        sx={{ borderRadius: 2, textTransform: 'none' }}>
                        {record ? 'Edit Record' : 'Create Record'}
                    </Button>
                </Box>
            )}

            {/* Edit Dialog */}
            <Dialog open={editing} onClose={() => setEditing(false)} maxWidth="md" fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Health Record</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={6} sm={3}>
                            <TextField select fullWidth label="Blood Group" size="small"
                                value={form.blood_group || ''} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                                {BLOOD_GROUPS.map((bg) => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField type="number" fullWidth label="Height (cm)" size="small"
                                value={form.height_cm || ''} onChange={(e) => setForm({ ...form, height_cm: parseFloat(e.target.value) })} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField type="number" fullWidth label="Weight (kg)" size="small"
                                value={form.weight_kg || ''} onChange={(e) => setForm({ ...form, weight_kg: parseFloat(e.target.value) })} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField fullWidth label="Vision Left" size="small"
                                value={form.vision_left || ''} onChange={(e) => setForm({ ...form, vision_left: e.target.value })} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField fullWidth label="Vision Right" size="small"
                                value={form.vision_right || ''} onChange={(e) => setForm({ ...form, vision_right: e.target.value })} />
                        </Grid>
                        {[['allergies', 'Allergies'], ['chronic_conditions', 'Chronic Conditions'],
                        ['current_medications', 'Current Medications'], ['dietary_restrictions', 'Dietary Restrictions'],
                        ['special_needs', 'Special Needs']].map(([key, label]) => (
                            <Grid item xs={12} sm={6} key={key}>
                                <TextField fullWidth label={label} size="small" multiline rows={2}
                                    value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                            </Grid>
                        ))}
                        {[['emergency_contact_name', 'Emergency Contact Name'], ['emergency_contact_phone', 'Emergency Phone'],
                        ['emergency_contact_relation', 'Relation'], ['family_doctor_name', 'Family Doctor'],
                        ['family_doctor_phone', 'Doctor Phone'], ['health_insurance_number', 'Insurance Number']].map(([key, label]) => (
                            <Grid item xs={12} sm={6} key={key}>
                                <TextField fullWidth label={label} size="small"
                                    value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                            </Grid>
                        ))}
                        <Grid item xs={12}>
                            <TextField fullWidth label="Notes" size="small" multiline rows={2}
                                value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setEditing(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={isSaving}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isSaving ? 'Saving…' : 'Save Record'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ─── Nurse Visits Tab ─────────────────────────────────────────────────────────
function NurseVisitsTab({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
    const { data: visits, isLoading } = useGetNurseVisitsQuery(studentId);
    const [logVisit, { isLoading: isLogging }] = useLogNurseVisitMutation();
    const [deleteVisit] = useDeleteNurseVisitMutation();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<any>({ visit_date: new Date().toISOString().slice(0, 16), sent_home: false, parent_notified: false, follow_up_required: false });

    const handleLog = async () => {
        try {
            await logVisit({ studentId, data: form }).unwrap();
            toast.success('Visit logged');
            setOpen(false);
            setForm({ visit_date: new Date().toISOString().slice(0, 16), sent_home: false, parent_notified: false, follow_up_required: false });
        } catch { toast.error('Failed to log visit'); }
    };

    const handleDelete = async (id: string) => {
        try { await deleteVisit(id).unwrap(); toast.success('Visit deleted'); }
        catch { toast.error('Failed to delete visit'); }
    };

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            {canEdit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        Log Visit
                    </Button>
                </Box>
            )}

            {(!visits || visits.length === 0) ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No nurse visits recorded.</Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visits.map((v) => (
                        <Card key={v.id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {new Date(v.visit_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        {v.sent_home && <Chip label="Sent Home" size="small" color="warning" icon={<Home />} />}
                                        {v.parent_notified && <Chip label="Parent Notified" size="small" color="info" icon={<CheckCircle />} />}
                                        {v.follow_up_required && <Chip label="Follow Up" size="small" color="error" icon={<Warning />} />}
                                    </Box>
                                </Box>
                                <Grid container spacing={1}>
                                    {v.symptoms && <Grid item xs={12} sm={6}><Typography variant="caption" color="text.secondary">Symptoms</Typography><Typography variant="body2">{v.symptoms}</Typography></Grid>}
                                    {v.diagnosis && <Grid item xs={12} sm={6}><Typography variant="caption" color="text.secondary">Diagnosis</Typography><Typography variant="body2">{v.diagnosis}</Typography></Grid>}
                                    {v.treatment_given && <Grid item xs={12} sm={6}><Typography variant="caption" color="text.secondary">Treatment</Typography><Typography variant="body2">{v.treatment_given}</Typography></Grid>}
                                    {v.medication_given && <Grid item xs={12} sm={6}><Typography variant="caption" color="text.secondary">Medication</Typography><Typography variant="body2">{v.medication_given}</Typography></Grid>}
                                </Grid>
                            </CardContent>
                            {canEdit && (
                                <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                                    <Button size="small" color="error" startIcon={<Delete />}
                                        onClick={() => handleDelete(v.id)} sx={{ textTransform: 'none' }}>Delete</Button>
                                </CardActions>
                            )}
                        </Card>
                    ))}
                </Box>
            )}

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Log Nurse Visit</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12}>
                            <TextField type="datetime-local" fullWidth label="Visit Date & Time" size="small" InputLabelProps={{ shrink: true }}
                                value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
                        </Grid>
                        {[['symptoms', 'Symptoms'], ['diagnosis', 'Diagnosis'], ['treatment_given', 'Treatment Given'], ['medication_given', 'Medication Given']].map(([key, label]) => (
                            <Grid item xs={12} sm={6} key={key}>
                                <TextField fullWidth label={label} size="small" multiline rows={2}
                                    value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                            </Grid>
                        ))}
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                {[['sent_home', 'Sent Home'], ['parent_notified', 'Parent Notified'], ['follow_up_required', 'Follow-up Required']].map(([key, label]) => (
                                    <Chip key={key} label={label} onClick={() => setForm({ ...form, [key]: !form[key] })}
                                        color={form[key] ? 'primary' : 'default'} variant={form[key] ? 'filled' : 'outlined'}
                                        sx={{ cursor: 'pointer' }} />
                                ))}
                            </Box>
                        </Grid>
                        {form.follow_up_required && (
                            <Grid item xs={12} sm={6}>
                                <TextField type="date" fullWidth label="Follow-up Date" size="small" InputLabelProps={{ shrink: true }}
                                    value={form.follow_up_date || ''} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
                            </Grid>
                        )}
                        <Grid item xs={12}>
                            <TextField fullWidth label="Notes" size="small" multiline rows={2}
                                value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleLog} disabled={isLogging}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isLogging ? 'Logging…' : 'Log Visit'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ─── Vaccinations Tab ─────────────────────────────────────────────────────────
function VaccinationsTab({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
    const { data: vaccinations, isLoading } = useGetVaccinationsQuery(studentId);
    const [addVax, { isLoading: isAdding }] = useAddVaccinationMutation();
    const [deleteVax] = useDeleteVaccinationMutation();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<any>({ dose_number: 1, status: 'completed' });

    const handleAdd = async () => {
        if (!form.vaccine_name) { toast.error('Vaccine name is required'); return; }
        try {
            await addVax({ studentId, data: form }).unwrap();
            toast.success('Vaccination added');
            setOpen(false);
            setForm({ dose_number: 1, status: 'completed' });
        } catch { toast.error('Failed to add vaccination'); }
    };

    if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            {canEdit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        Add Vaccination
                    </Button>
                </Box>
            )}

            {(!vaccinations || vaccinations.length === 0) ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No vaccinations recorded.</Alert>
            ) : (
                <Grid container spacing={2}>
                    {vaccinations.map((v) => (
                        <Grid item xs={12} sm={6} md={4} key={v.id}>
                            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Chip label={v.status.toUpperCase()} size="small" color={STATUS_COLORS[v.status]} />
                                        <Typography variant="caption" color="text.secondary">Dose {v.dose_number}</Typography>
                                    </Box>
                                    <Typography variant="subtitle2" fontWeight={700}>{v.vaccine_name}</Typography>
                                    {v.administered_date && <Typography variant="body2" color="text.secondary">Given: {v.administered_date}</Typography>}
                                    {v.administered_by && <Typography variant="caption" color="text.secondary">By: {v.administered_by}</Typography>}
                                    {v.next_due_date && (
                                        <Chip label={`Next due: ${v.next_due_date}`} size="small" color="warning"
                                            sx={{ mt: 1, fontSize: '0.65rem' }} />
                                    )}
                                </CardContent>
                                {canEdit && (
                                    <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                                        <Button size="small" color="error" startIcon={<Delete />}
                                            onClick={() => deleteVax(v.id)} sx={{ textTransform: 'none' }}>Remove</Button>
                                    </CardActions>
                                )}
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Add Vaccination</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={8}>
                            <TextField fullWidth label="Vaccine Name *" size="small"
                                value={form.vaccine_name || ''} onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField type="number" fullWidth label="Dose Number" size="small"
                                value={form.dose_number} onChange={(e) => setForm({ ...form, dose_number: parseInt(e.target.value) })} inputProps={{ min: 1 }} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField type="date" fullWidth label="Date Administered" size="small" InputLabelProps={{ shrink: true }}
                                value={form.administered_date || ''} onChange={(e) => setForm({ ...form, administered_date: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField type="date" fullWidth label="Next Due Date" size="small" InputLabelProps={{ shrink: true }}
                                value={form.next_due_date || ''} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Administered By" size="small"
                                value={form.administered_by || ''} onChange={(e) => setForm({ ...form, administered_by: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="Status" size="small"
                                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                {VAX_STATUSES.map((s) => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Batch Number" size="small"
                                value={form.batch_number || ''} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAdd} disabled={isAdding}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isAdding ? 'Adding…' : 'Add Vaccination'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
