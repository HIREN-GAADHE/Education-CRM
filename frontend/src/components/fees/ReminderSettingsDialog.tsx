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
    Divider
} from '@mui/material';
import { useGetReminderSettingsQuery, useUpdateReminderSettingsMutation, useGetReminderTemplatesQuery } from '../../store/api/remindersApi';
import { toast } from 'react-toastify';

interface ReminderSettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

const ReminderSettingsDialog: React.FC<ReminderSettingsDialogProps> = ({ open, onClose }) => {
    const { data: settings, isLoading } = useGetReminderSettingsQuery();
    const { data: templates } = useGetReminderTemplatesQuery();
    const [updateSettings, { isLoading: isUpdating }] = useUpdateReminderSettingsMutation();

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
            }).unwrap();
            toast.success('Settings updated successfully');
            onClose();
        } catch (error) {
            toast.error('Failed to update settings');
        }
    };

    if (isLoading) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Fee Reminder Settings</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={3}>
                    {/* General Automation */}
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
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={isUpdating}>
                    Save Settings
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReminderSettingsDialog;
