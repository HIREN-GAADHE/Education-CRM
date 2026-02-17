import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    FormControlLabel,
    Switch,
    Typography,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Divider,
    Box,
    IconButton,
    Card,
    CardContent,
    CardActions,
    Chip,
    Alert,
    Tab,
    Tabs
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import {
    useGetReminderSettingsQuery,
    useUpdateReminderSettingsMutation,
    useGetReminderTemplatesQuery,
    useCreateReminderTemplateMutation,
    useUpdateReminderTemplateMutation,
    useDeleteReminderTemplateMutation,
} from '../../store/api/remindersApi';
import type { ReminderTemplate } from '../../store/api/remindersApi';
import { toast } from 'react-toastify';

interface ReminderSettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
        </div>
    );
}

const ReminderSettingsDialog: React.FC<ReminderSettingsDialogProps> = ({ open, onClose }) => {
    const { data: settings, isLoading } = useGetReminderSettingsQuery();
    const { data: templates } = useGetReminderTemplatesQuery();
    const [updateSettings, { isLoading: isUpdating }] = useUpdateReminderSettingsMutation();
    const [createTemplate] = useCreateReminderTemplateMutation();
    const [updateTemplate] = useUpdateReminderTemplateMutation();
    const [deleteTemplate] = useDeleteReminderTemplateMutation();

    const [activeTab, setActiveTab] = useState(0);

    // Settings form state
    const [formData, setFormData] = useState({
        auto_reminders_enabled: true,
        reminder_days_before: '7, 3, 1',
        reminder_days_after: '1, 7, 14, 30',
        monthly_reminder_enabled: false,
        monthly_reminder_day: 5,
        monthly_reminder_template_id: '',
        email_enabled: true,
        sms_enabled: false,
        in_app_enabled: true,
    });

    // Template editor state
    const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [templateForm, setTemplateForm] = useState({
        name: '',
        type: 'email' as 'email' | 'sms' | 'in_app',
        subject: '',
        body: '',
        is_active: true,
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                auto_reminders_enabled: settings.auto_reminders_enabled ?? true,
                reminder_days_before: settings.reminder_days_before?.join(', ') || '7, 3, 1',
                reminder_days_after: settings.reminder_days_after?.join(', ') || '1, 7, 14, 30',
                monthly_reminder_enabled: settings.monthly_reminder_enabled ?? false,
                monthly_reminder_day: settings.monthly_reminder_day || 5,
                monthly_reminder_template_id: settings.monthly_reminder_template_id || '',
                email_enabled: settings.email_enabled ?? true,
                sms_enabled: settings.sms_enabled ?? false,
                in_app_enabled: settings.in_app_enabled ?? true,
            });
        }
    }, [settings]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            await updateSettings({
                ...formData,
                reminder_days_before: formData.reminder_days_before.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)),
                reminder_days_after: formData.reminder_days_after.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)),
                monthly_reminder_day: typeof formData.monthly_reminder_day === 'string' ? parseInt(formData.monthly_reminder_day) : formData.monthly_reminder_day,
                monthly_reminder_template_id: formData.monthly_reminder_template_id || undefined,
            }).unwrap();
            toast.success('Settings updated successfully');
            onClose();
        } catch (error) {
            toast.error('Failed to update settings');
        }
    };

    // Template handlers
    const handleNewTemplate = () => {
        setEditingTemplate(null);
        setTemplateForm({ name: '', type: 'email', subject: '', body: '', is_active: true });
        setShowTemplateForm(true);
    };

    const handleEditTemplate = (template: ReminderTemplate) => {
        setEditingTemplate(template);
        setTemplateForm({
            name: template.name,
            type: template.type,
            subject: template.subject || '',
            body: template.body,
            is_active: template.is_active,
        });
        setShowTemplateForm(true);
    };

    const handleSaveTemplate = async () => {
        if (!templateForm.name || !templateForm.body) {
            toast.error('Name and Body are required');
            return;
        }
        try {
            if (editingTemplate) {
                await updateTemplate({
                    id: editingTemplate.id,
                    data: templateForm,
                }).unwrap();
                toast.success('Template updated');
            } else {
                await createTemplate(templateForm).unwrap();
                toast.success('Template created');
            }
            setShowTemplateForm(false);
            setEditingTemplate(null);
        } catch (error) {
            toast.error('Failed to save template');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        try {
            await deleteTemplate(id).unwrap();
            toast.success('Template deleted');
        } catch (error) {
            toast.error('Failed to delete template');
        }
    };

    if (isLoading) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Fee Reminder Settings</DialogTitle>
            <DialogContent dividers>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 1 }}>
                    <Tab label="Settings" />
                    <Tab label="Email Templates" />
                </Tabs>

                {/* Settings Tab */}
                <TabPanel value={activeTab} index={0}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>Automated Due Date Reminders</Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.auto_reminders_enabled}
                                        onChange={(e) => handleChange('auto_reminders_enabled', e.target.checked)}
                                    />
                                }
                                label="Enable Auto-Reminders based on Due Date"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Remind Days Before Due (comma separated)"
                                value={formData.reminder_days_before}
                                onChange={(e) => handleChange('reminder_days_before', e.target.value)}
                                disabled={!formData.auto_reminders_enabled}
                                helperText="e.g. 7, 3, 1 days before"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Remind Days After Due (comma separated)"
                                value={formData.reminder_days_after}
                                onChange={(e) => handleChange('reminder_days_after', e.target.value)}
                                disabled={!formData.auto_reminders_enabled}
                                helperText="e.g. 1, 7, 14 days overdue"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h6" gutterBottom>Monthly Recurring Schedule</Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Send reminders to ALL students with pending fees on a specific day of every month.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.monthly_reminder_enabled}
                                        onChange={(e) => handleChange('monthly_reminder_enabled', e.target.checked)}
                                    />
                                }
                                label="Enable Monthly Batch Reminder"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth disabled={!formData.monthly_reminder_enabled}>
                                <InputLabel>Run on Day of Month</InputLabel>
                                <Select
                                    value={formData.monthly_reminder_day}
                                    label="Run on Day of Month"
                                    onChange={(e) => handleChange('monthly_reminder_day', e.target.value)}
                                >
                                    {[...Array(28)].map((_, i) => (
                                        <MenuItem key={i + 1} value={i + 1}>{i + 1}{['st', 'nd', 'rd'][i] || 'th'}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth disabled={!formData.monthly_reminder_enabled}>
                                <InputLabel>Email Template</InputLabel>
                                <Select
                                    value={formData.monthly_reminder_template_id}
                                    label="Email Template"
                                    onChange={(e) => handleChange('monthly_reminder_template_id', e.target.value)}
                                >
                                    <MenuItem value=""><em>Default</em></MenuItem>
                                    {templates?.filter(t => t.is_active && t.type === 'email').map(t => (
                                        <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h6" gutterBottom>Channels</Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.email_enabled}
                                        onChange={(e) => handleChange('email_enabled', e.target.checked)}
                                    />
                                }
                                label="Email"
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.sms_enabled}
                                        onChange={(e) => handleChange('sms_enabled', e.target.checked)}
                                    />
                                }
                                label="SMS (Coming Soon)"
                                disabled
                            />
                        </Grid>
                    </Grid>
                </TabPanel>

                {/* Email Templates Tab */}
                <TabPanel value={activeTab} index={1}>
                    {!showTemplateForm ? (
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h6">Email Templates</Typography>
                                <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={handleNewTemplate}>
                                    New Template
                                </Button>
                            </Box>

                            {(!templates || templates.length === 0) && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    No templates yet. Create one to customize your reminder emails.
                                </Alert>
                            )}

                            {templates?.map(template => (
                                <Card key={template.id} variant="outlined" sx={{ mb: 1.5 }}>
                                    <CardContent sx={{ pb: 0 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={600}>{template.name}</Typography>
                                                {template.subject && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Subject: {template.subject}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Box>
                                                <Chip
                                                    label={template.type}
                                                    size="small"
                                                    color={template.type === 'email' ? 'primary' : 'default'}
                                                    sx={{ mr: 1 }}
                                                />
                                                <Chip
                                                    label={template.is_active ? 'Active' : 'Inactive'}
                                                    size="small"
                                                    color={template.is_active ? 'success' : 'default'}
                                                />
                                            </Box>
                                        </Box>
                                        <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>
                                            {template.body}
                                        </Typography>
                                    </CardContent>
                                    <CardActions sx={{ justifyContent: 'flex-end' }}>
                                        <IconButton size="small" onClick={() => handleEditTemplate(template)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteTemplate(template.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </CardActions>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                {editingTemplate ? 'Edit Template' : 'New Template'}
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={8}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Template Name"
                                        value={templateForm.name}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Polite Reminder"
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Type</InputLabel>
                                        <Select
                                            value={templateForm.type}
                                            label="Type"
                                            onChange={(e) => setTemplateForm(prev => ({ ...prev, type: e.target.value as any }))}
                                        >
                                            <MenuItem value="email">Email</MenuItem>
                                            <MenuItem value="sms" disabled>SMS</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Subject"
                                        value={templateForm.subject}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                                        placeholder="e.g. Fee Payment Reminder for {student_name}"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Email Body"
                                        multiline
                                        rows={8}
                                        value={templateForm.body}
                                        onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                                        placeholder="Dear Parent/Guardian,

This is a reminder that the {fee_type} fee of {amount} for {student_name} is due on {due_date}.

Current balance: {balance}

Please ensure timely payment.

Thank you."
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Alert severity="info" sx={{ py: 0.5 }}>
                                        <Typography variant="body2">
                                            <strong>Available placeholders:</strong>{' '}
                                            <code>{'{student_name}'}</code>, <code>{'{first_name}'}</code>, <code>{'{amount}'}</code>,{' '}
                                            <code>{'{balance}'}</code>, <code>{'{due_date}'}</code>, <code>{'{fee_type}'}</code>,{' '}
                                            <code>{'{transaction_id}'}</code>, <code>{'{academic_year}'}</code>
                                        </Typography>
                                    </Alert>
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={templateForm.is_active}
                                                onChange={(e) => setTemplateForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                            />
                                        }
                                        label="Active"
                                    />
                                </Grid>
                            </Grid>
                            <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                                <Button onClick={() => setShowTemplateForm(false)}>Cancel</Button>
                                <Button variant="contained" onClick={handleSaveTemplate}>
                                    {editingTemplate ? 'Update Template' : 'Create Template'}
                                </Button>
                            </Box>
                        </Box>
                    )}
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                {activeTab === 0 && (
                    <Button onClick={handleSave} variant="contained" disabled={isUpdating}>
                        Save Settings
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ReminderSettingsDialog;
