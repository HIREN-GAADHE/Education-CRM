import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, FormControl, InputLabel, Select, MenuItem,
    Box, Typography, Checkbox, FormControlLabel, CircularProgress,
    Alert, Chip
} from '@mui/material';
import { Close as CloseIcon, Send as SendIcon } from '@mui/icons-material';
import { useGetReminderTemplatesQuery, useSendRemindersMutation } from '@/store/api/remindersApi';
import { toast } from 'react-toastify';

interface ReminderDialogProps {
    open: boolean;
    onClose: () => void;
    studentIds: string[];
    feePaymentIds?: string[]; // Optional, if sending for specific payments
    studentName?: string; // For single student display
}

export const ReminderDialog: React.FC<ReminderDialogProps> = ({
    open, onClose, studentIds, feePaymentIds, studentName
}) => {
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [customMessage, setCustomMessage] = useState('');
    const [channels, setChannels] = useState<{ email: boolean; sms: boolean }>({
        email: true,
        sms: false // Default off, and will be disabled
    });

    const { data: templates, isLoading: isLoadingTemplates } = useGetReminderTemplatesQuery();
    const [sendReminders, { isLoading: isSending }] = useSendRemindersMutation();

    // Reset form on open
    useEffect(() => {
        if (open) {
            setCustomMessage('');
            setSelectedTemplate('');
            setChannels({ email: true, sms: false });
        }
    }, [open]);

    // Update message when template selected
    useEffect(() => {
        if (selectedTemplate && templates) {
            const template = templates.find(t => t.id === selectedTemplate);
            if (template) {
                setCustomMessage(template.body);
            }
        }
    }, [selectedTemplate, templates]);

    const handleSend = async () => {
        const selectedChannels: ('email' | 'sms' | 'in_app')[] = [];
        if (channels.email) selectedChannels.push('email');
        if (channels.sms) selectedChannels.push('sms');

        if (selectedChannels.length === 0) {
            toast.error('Please select at least one notification channel');
            return;
        }

        try {
            await sendReminders({
                student_ids: studentIds,
                fee_payment_ids: feePaymentIds,
                channels: selectedChannels,
                template_id: selectedTemplate || undefined,
                custom_message: customMessage
            }).unwrap();

            toast.success('Reminders sent successfully!');
            onClose();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to send reminders');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Send Fee Reminder
                <Box sx={{ position: 'absolute', right: 8, top: 8 }}>
                    <Button size="small" onClick={onClose} sx={{ minWidth: 40 }}><CloseIcon /></Button>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Recipients Info */}
                    <Alert severity="info" icon={false} sx={{ py: 0, px: 2 }}>
                        <Typography variant="body2">
                            Sending to: <strong>{studentIds.length > 1 ? `${studentIds.length} Students` : studentName || 'Selected Student'}</strong>
                        </Typography>
                    </Alert>

                    {/* Channels */}
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>Notification Channels</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={channels.email}
                                        onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                                    />
                                }
                                label="Email"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={channels.sms}
                                        onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                                        disabled // Disabled as per user request
                                    />
                                }
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        SMS <Chip label="Coming Soon" size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
                                    </Box>
                                }
                            />
                        </Box>
                    </Box>

                    {/* Template Selection */}
                    <FormControl fullWidth size="small">
                        <InputLabel>Select Template (Optional)</InputLabel>
                        <Select
                            value={selectedTemplate}
                            label="Select Template (Optional)"
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            disabled={isLoadingTemplates}
                        >
                            <MenuItem value=""><em>None (Custom Message)</em></MenuItem>
                            {templates?.filter(t => t.type === 'email').map(t => (
                                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Message Body */}
                    <TextField
                        label="Message"
                        multiline
                        rows={6}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Enter your reminder message here..."
                        fullWidth
                        helperText="You can use placeholders like {student_name}, {amount}, {due_date}"
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={isSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    onClick={handleSend}
                    disabled={isSending || (!customMessage && !selectedTemplate)}
                >
                    Send Reminder
                </Button>
            </DialogActions>
        </Dialog>
    );
};
