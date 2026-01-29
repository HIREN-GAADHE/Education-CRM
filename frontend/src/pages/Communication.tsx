import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, Grid, Chip, IconButton,
    TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Alert, List, ListItem, ListItemText, ListItemAvatar,
    Avatar, Divider, Tabs, Tab, InputAdornment, FormControl, InputLabel,
    Select, MenuItem, CardContent, Checkbox, FormControlLabel, FormGroup,
    Switch, Autocomplete, Paper
} from '@mui/material';
import {
    Send as SendIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Mail as MailIcon,
    Inbox as InboxIcon,
    Search as SearchIcon,
    Reply as ReplyIcon,
    PriorityHigh as UrgentIcon,
    Flag as ImportantIcon,
    Email as EmailIcon,
    Sms as SmsIcon,
    Campaign as AnnouncementIcon,
    Notifications as NotifIcon,
    Group as GroupIcon,
    School as SchoolIcon,
    People as PeopleIcon,
} from '@mui/icons-material';
import {
    useGetMessagesQuery,
    useSendMessageMutation,
    useUpdateMessageMutation,
    useDeleteMessageMutation,
    useGetRecipientCountMutation,
    useSendBulkMessagesMutation,
    Message
} from '@/store/api/messageApi';
import { useGetClassesQuery } from '@/store/api/academicApi';
import { toast } from 'react-toastify';

type MessageType = 'email' | 'sms' | 'announcement' | 'notification';

const CommunicationPage: React.FC = () => {
    const [folder, setFolder] = useState<string>('inbox');
    const [search, setSearch] = useState('');
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [openCompose, setOpenCompose] = useState(false);
    const [openView, setOpenView] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<MessageType>('email');

    const [composeForm, setComposeForm] = useState({
        recipient_name: '',
        recipient_email: '',
        recipient_type: 'user',
        subject: '',
        body: '',
        priority: 'normal',
        is_important: false,
    });

    // SMS specific
    const [smsForm, setSmsForm] = useState({
        phone_numbers: '',
        message: '',
        recipient_groups: [] as string[],
    });

    // Announcement specific
    const [announcementForm, setAnnouncementForm] = useState({
        title: '',
        content: '',
        target_audience: 'all',
        priority: 'normal',
    });

    // Push notification specific
    const [notificationForm, setNotificationForm] = useState({
        title: '',
        body: '',
        target_audience: 'all',
        action_url: '',
    });

    const { data: messages, isLoading, error, refetch } = useGetMessagesQuery({
        page: 1,
        pageSize: 50,
        folder,
        search: search || undefined,
    });
    const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
    const [updateMessage] = useUpdateMessageMutation();
    const [deleteMessage, { isLoading: isDeleting }] = useDeleteMessageMutation();
    const [getRecipientCount, { isLoading: isCountingRecipients }] = useGetRecipientCountMutation();
    const [sendBulkMessages, { isLoading: isSendingBulk }] = useSendBulkMessagesMutation();
    const { data: classesData } = useGetClassesQuery();

    // Class-wise filtering state
    const [useClassFilter, setUseClassFilter] = useState(false);
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [recipientRoles, setRecipientRoles] = useState({
        students: true,
        parents: false,
        teachers: false,
    });
    const [recipientCounts, setRecipientCounts] = useState<{ students: number; parents: number; teachers: number; total: number } | null>(null);

    const recipientGroups = [
        { value: 'all_students', label: 'All Students' },
        { value: 'all_staff', label: 'All Staff' },
        { value: 'all_parents', label: 'All Parents' },
        { value: 'teachers', label: 'Teachers Only' },
        { value: 'admin', label: 'Admin Staff' },
    ];

    const quickActions = [
        {
            title: 'Send Email',
            description: 'Compose and send emails',
            icon: <EmailIcon />,
            color: '#667eea',
            action: () => { setMessageType('email'); setOpenCompose(true); }
        },
        {
            title: 'SMS Broadcast',
            description: 'Send bulk SMS messages',
            icon: <SmsIcon />,
            color: '#43e97b',
            action: () => { setMessageType('sms'); setOpenCompose(true); }
        },
        {
            title: 'Announcement',
            description: 'Post announcements',
            icon: <AnnouncementIcon />,
            color: '#f5576c',
            action: () => { setMessageType('announcement'); setOpenCompose(true); }
        },
        {
            title: 'Push Notification',
            description: 'Send app notifications',
            icon: <NotifIcon />,
            color: '#4facfe',
            action: () => { setMessageType('notification'); setOpenCompose(true); }
        },
    ];

    const handleFolderChange = (_event: React.SyntheticEvent, newValue: string) => {
        setFolder(newValue);
    };

    const handleOpenCompose = () => {
        setMessageType('email');
        resetForms();
        setOpenCompose(true);
    };

    const resetForms = () => {
        setComposeForm({
            recipient_name: '',
            recipient_email: '',
            recipient_type: 'user',
            subject: '',
            body: '',
            priority: 'normal',
            is_important: false,
        });
        setSmsForm({
            phone_numbers: '',
            message: '',
            recipient_groups: [],
        });
        setAnnouncementForm({
            title: '',
            content: '',
            target_audience: 'all',
            priority: 'normal',
        });
        setNotificationForm({
            title: '',
            body: '',
            target_audience: 'all',
            action_url: '',
        });
        // Reset class filtering
        setUseClassFilter(false);
        setSelectedClassIds([]);
        setRecipientRoles({ students: true, parents: false, teachers: false });
        setRecipientCounts(null);
    };

    // Fetch recipient counts when class selection or roles change
    useEffect(() => {
        const fetchCounts = async () => {
            if (!useClassFilter || selectedClassIds.length === 0) {
                setRecipientCounts(null);
                return;
            }

            const roles: string[] = [];
            if (recipientRoles.students) roles.push('students');
            if (recipientRoles.parents) roles.push('parents');
            if (recipientRoles.teachers) roles.push('teachers');

            if (roles.length === 0) {
                setRecipientCounts(null);
                return;
            }

            try {
                const result = await getRecipientCount({
                    class_ids: selectedClassIds,
                    recipient_roles: roles
                }).unwrap();
                setRecipientCounts(result);
            } catch (err) {
                console.error('Failed to get recipient count:', err);
            }
        };

        fetchCounts();
    }, [useClassFilter, selectedClassIds, recipientRoles, getRecipientCount]);

    const handleSend = async () => {
        try {
            // Handle class-based bulk messaging
            if (useClassFilter && selectedClassIds.length > 0) {
                const roles: string[] = [];
                if (recipientRoles.students) roles.push('students');
                if (recipientRoles.parents) roles.push('parents');
                if (recipientRoles.teachers) roles.push('teachers');

                if (roles.length === 0) {
                    toast.error('Please select at least one recipient type');
                    return;
                }

                let subject = '';
                let body = '';
                let priority = 'normal';
                let is_important = false;

                if (messageType === 'email') {
                    if (!composeForm.subject.trim() || !composeForm.body.trim()) {
                        toast.error('Please fill in subject and message');
                        return;
                    }
                    subject = composeForm.subject;
                    body = composeForm.body;
                    priority = composeForm.priority;
                    is_important = composeForm.is_important;
                } else if (messageType === 'announcement') {
                    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
                        toast.error('Please fill in title and content');
                        return;
                    }
                    subject = `📢 ${announcementForm.title}`;
                    body = announcementForm.content;
                    priority = announcementForm.priority;
                    is_important = announcementForm.priority === 'urgent';
                } else if (messageType === 'notification') {
                    if (!notificationForm.title.trim() || !notificationForm.body.trim()) {
                        toast.error('Please fill in title and body');
                        return;
                    }
                    subject = `🔔 ${notificationForm.title}`;
                    body = notificationForm.body;
                    priority = 'high';
                    is_important = true;
                }

                const result = await sendBulkMessages({
                    class_ids: selectedClassIds,
                    recipient_roles: roles,
                    subject,
                    body,
                    priority,
                    is_important
                }).unwrap();

                toast.success(`Successfully sent to ${result.created} recipients!`);
                setOpenCompose(false);
                resetForms();
                refetch();
                return;
            }

            // Regular (non-class-based) message handling
            let payload: any = {};

            if (messageType === 'email') {
                if (!composeForm.subject.trim() || !composeForm.body.trim()) {
                    toast.error('Please fill in subject and message');
                    return;
                }
                payload = {
                    recipient_name: composeForm.recipient_name || 'All Users',
                    recipient_email: composeForm.recipient_email || '',
                    recipient_type: 'email',
                    subject: composeForm.subject,
                    body: composeForm.body,
                    priority: composeForm.priority,
                    is_important: composeForm.is_important,
                };
            } else if (messageType === 'sms') {
                if (!smsForm.message.trim()) {
                    toast.error('Please enter SMS message');
                    return;
                }
                if (!smsForm.phone_numbers.trim() && smsForm.recipient_groups.length === 0) {
                    toast.error('Please enter phone numbers or select recipient groups');
                    return;
                }
                payload = {
                    recipient_name: smsForm.recipient_groups.length > 0
                        ? smsForm.recipient_groups.join(', ')
                        : 'Custom Numbers',
                    recipient_email: smsForm.phone_numbers,
                    recipient_type: 'sms',
                    subject: `SMS Broadcast`,
                    body: smsForm.message,
                    priority: 'normal',
                    is_important: false,
                };
            } else if (messageType === 'announcement') {
                if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
                    toast.error('Please fill in title and content');
                    return;
                }
                payload = {
                    recipient_name: announcementForm.target_audience,
                    recipient_type: 'announcement',
                    subject: `📢 ${announcementForm.title}`,
                    body: announcementForm.content,
                    priority: announcementForm.priority,
                    is_important: announcementForm.priority === 'urgent',
                };
            } else if (messageType === 'notification') {
                if (!notificationForm.title.trim() || !notificationForm.body.trim()) {
                    toast.error('Please fill in title and body');
                    return;
                }
                payload = {
                    recipient_name: notificationForm.target_audience,
                    recipient_type: 'push_notification',
                    subject: `🔔 ${notificationForm.title}`,
                    body: notificationForm.body + (notificationForm.action_url ? `\n\nAction: ${notificationForm.action_url}` : ''),
                    priority: 'high',
                    is_important: true,
                };
            }

            await sendMessage(payload).unwrap();

            const typeLabels: Record<MessageType, string> = {
                email: 'Email sent',
                sms: 'SMS broadcast queued',
                announcement: 'Announcement posted',
                notification: 'Push notification sent',
            };

            toast.success(typeLabels[messageType] + ' successfully!');
            setOpenCompose(false);
            resetForms();
            refetch();
        } catch (err: any) {
            console.error('Send error:', err);
            toast.error(err?.data?.detail || 'Failed to send');
        }
    };

    const handleViewMessage = async (message: Message) => {
        setSelectedMessage(message);
        setOpenView(true);

        // Mark as read if not already read
        if (message.status !== 'read') {
            try {
                await updateMessage({
                    id: message.id,
                    data: { status: 'read' }
                }).unwrap();
                refetch();
            } catch (err) {
                // Silently fail - message is still viewable
                console.error('Failed to mark as read:', err);
            }
        }
    };

    const handleCloseView = () => {
        setOpenView(false);
        setSelectedMessage(null);
    };

    const handleToggleStar = async (message: Message, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await updateMessage({
                id: message.id,
                data: { is_starred: !message.is_starred }
            }).unwrap();
            refetch();
        } catch (err) {
            toast.error('Failed to update');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMessage(id).unwrap();
            toast.success('Message deleted!');
            setDeleteConfirm(null);
            handleCloseView();
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'error';
            case 'high': return 'warning';
            case 'low': return 'default';
            default: return 'primary';
        }
    };

    const getMessageTypeIcon = (recipientType?: string) => {
        switch (recipientType) {
            case 'sms': return <SmsIcon fontSize="small" color="success" />;
            case 'announcement': return <AnnouncementIcon fontSize="small" color="error" />;
            case 'push_notification': return <NotifIcon fontSize="small" color="info" />;
            default: return <EmailIcon fontSize="small" color="primary" />;
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Helper function to render class filter UI
    const renderClassFilterUI = () => (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: useClassFilter ? 2 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SchoolIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>
                        Send to Specific Classes
                    </Typography>
                </Box>
                <Switch
                    checked={useClassFilter}
                    onChange={(e) => setUseClassFilter(e.target.checked)}
                    color="primary"
                />
            </Box>

            {useClassFilter && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Class Selection */}
                    <FormControl fullWidth>
                        <InputLabel>Select Classes</InputLabel>
                        <Select
                            multiple
                            value={selectedClassIds}
                            label="Select Classes"
                            onChange={(e) => setSelectedClassIds(e.target.value as string[])}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((id) => {
                                        const cls = classesData?.find((c: any) => c.id === id);
                                        return <Chip key={id} label={cls?.name || id} size="small" />;
                                    })}
                                </Box>
                            )}
                        >
                            {classesData?.map((cls: any) => (
                                <MenuItem key={cls.id} value={cls.id}>
                                    <Checkbox checked={selectedClassIds.includes(cls.id)} />
                                    <ListItemText primary={cls.name} secondary={cls.section ? `Section ${cls.section}` : undefined} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Recipient Role Checkboxes */}
                    <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Send to:
                        </Typography>
                        <FormGroup row>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={recipientRoles.students}
                                        onChange={(e) => setRecipientRoles({ ...recipientRoles, students: e.target.checked })}
                                    />
                                }
                                label="Students"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={recipientRoles.parents}
                                        onChange={(e) => setRecipientRoles({ ...recipientRoles, parents: e.target.checked })}
                                    />
                                }
                                label="Parents"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={recipientRoles.teachers}
                                        onChange={(e) => setRecipientRoles({ ...recipientRoles, teachers: e.target.checked })}
                                    />
                                }
                                label="Teachers"
                            />
                        </FormGroup>
                    </Box>

                    {/* Recipient Count Preview */}
                    {recipientCounts && (
                        <Alert severity="info" icon={<PeopleIcon />}>
                            <strong>Estimated Recipients:</strong>{' '}
                            {recipientRoles.students && recipientCounts.students > 0 && (
                                <Chip label={`${recipientCounts.students} students`} size="small" sx={{ mr: 0.5 }} />
                            )}
                            {recipientRoles.parents && recipientCounts.parents > 0 && (
                                <Chip label={`${recipientCounts.parents} parents`} size="small" sx={{ mr: 0.5 }} />
                            )}
                            {recipientRoles.teachers && recipientCounts.teachers > 0 && (
                                <Chip label={`${recipientCounts.teachers} teachers`} size="small" sx={{ mr: 0.5 }} />
                            )}
                            {recipientCounts.total > 0 && (
                                <Typography component="span" variant="body2" sx={{ ml: 1 }}>
                                    ({recipientCounts.total} total)
                                </Typography>
                            )}
                        </Alert>
                    )}

                    {isCountingRecipients && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">Counting recipients...</Typography>
                        </Box>
                    )}

                    {selectedClassIds.length === 0 && (
                        <Alert severity="warning">Please select at least one class.</Alert>
                    )}
                </Box>
            )}
        </Paper>
    );

    const renderComposeContent = () => {
        switch (messageType) {
            case 'sms':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
                        <Alert severity="info">
                            SMS will be sent to the specified phone numbers or selected groups.
                        </Alert>
                        <TextField
                            fullWidth
                            label="Phone Numbers"
                            placeholder="Enter comma-separated phone numbers (e.g., +91-9876543210, +91-9876543211)"
                            value={smsForm.phone_numbers}
                            onChange={(e) => setSmsForm({ ...smsForm, phone_numbers: e.target.value })}
                            helperText="Leave empty if sending to groups"
                        />
                        <FormControl fullWidth>
                            <InputLabel>Recipient Groups (Optional)</InputLabel>
                            <Select
                                multiple
                                value={smsForm.recipient_groups}
                                label="Recipient Groups (Optional)"
                                onChange={(e) => setSmsForm({ ...smsForm, recipient_groups: e.target.value as string[] })}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => (
                                            <Chip key={value} label={recipientGroups.find(g => g.value === value)?.label || value} size="small" />
                                        ))}
                                    </Box>
                                )}
                            >
                                {recipientGroups.map((group) => (
                                    <MenuItem key={group.value} value={group.value}>
                                        {group.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="SMS Message"
                            required
                            multiline
                            rows={4}
                            value={smsForm.message}
                            onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })}
                            placeholder="Type your SMS message here..."
                            helperText={`${smsForm.message.length}/160 characters (${Math.ceil(smsForm.message.length / 160)} SMS)`}
                        />
                    </Box>
                );

            case 'announcement':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
                        <Alert severity="warning">
                            Announcements will be visible to all users in the selected audience.
                        </Alert>
                        <TextField
                            fullWidth
                            label="Announcement Title"
                            required
                            value={announcementForm.title}
                            onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                            placeholder="e.g., School Holiday Notice"
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Target Audience</InputLabel>
                                    <Select
                                        value={announcementForm.target_audience}
                                        label="Target Audience"
                                        onChange={(e) => setAnnouncementForm({ ...announcementForm, target_audience: e.target.value })}
                                    >
                                        <MenuItem value="all">Everyone</MenuItem>
                                        <MenuItem value="students">Students Only</MenuItem>
                                        <MenuItem value="staff">Staff Only</MenuItem>
                                        <MenuItem value="parents">Parents Only</MenuItem>
                                        <MenuItem value="teachers">Teachers Only</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        value={announcementForm.priority}
                                        label="Priority"
                                        onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value })}
                                    >
                                        <MenuItem value="low">Low</MenuItem>
                                        <MenuItem value="normal">Normal</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                        <MenuItem value="urgent">Urgent</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <TextField
                            fullWidth
                            label="Announcement Content"
                            required
                            multiline
                            rows={8}
                            value={announcementForm.content}
                            onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                            placeholder="Write your announcement here..."
                        />
                    </Box>
                );

            case 'notification':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
                        <Alert severity="info">
                            Push notifications will be sent to mobile app users.
                        </Alert>
                        <TextField
                            fullWidth
                            label="Notification Title"
                            required
                            value={notificationForm.title}
                            onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                            placeholder="e.g., Fee Payment Reminder"
                            helperText="Keep it short and attention-grabbing"
                        />
                        <FormControl fullWidth>
                            <InputLabel>Target Audience</InputLabel>
                            <Select
                                value={notificationForm.target_audience}
                                label="Target Audience"
                                onChange={(e) => setNotificationForm({ ...notificationForm, target_audience: e.target.value })}
                            >
                                <MenuItem value="all">All App Users</MenuItem>
                                <MenuItem value="students">Students</MenuItem>
                                <MenuItem value="staff">Staff</MenuItem>
                                <MenuItem value="parents">Parents</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            label="Notification Body"
                            required
                            multiline
                            rows={4}
                            value={notificationForm.body}
                            onChange={(e) => setNotificationForm({ ...notificationForm, body: e.target.value })}
                            placeholder="Notification message content..."
                            helperText="Keep it concise for better visibility"
                        />
                        <TextField
                            fullWidth
                            label="Action URL (Optional)"
                            value={notificationForm.action_url}
                            onChange={(e) => setNotificationForm({ ...notificationForm, action_url: e.target.value })}
                            placeholder="https://..."
                            helperText="URL to open when user taps the notification"
                        />
                    </Box>
                );

            default: // email
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
                        {/* Class Filter UI - Enable targeted messaging */}
                        {renderClassFilterUI()}

                        {!useClassFilter && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Recipient Name"
                                        placeholder="e.g., John Doe or All Staff"
                                        value={composeForm.recipient_name}
                                        onChange={(e) => setComposeForm({ ...composeForm, recipient_name: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Recipient Email"
                                        type="email"
                                        placeholder="e.g., john@school.edu"
                                        value={composeForm.recipient_email}
                                        onChange={(e) => setComposeForm({ ...composeForm, recipient_email: e.target.value })}
                                    />
                                </Grid>
                            </Grid>
                        )}
                        <TextField
                            fullWidth
                            label="Subject"
                            required
                            value={composeForm.subject}
                            onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                            placeholder="Enter message subject"
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        value={composeForm.priority}
                                        label="Priority"
                                        onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value })}
                                    >
                                        <MenuItem value="low">Low</MenuItem>
                                        <MenuItem value="normal">Normal</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                        <MenuItem value="urgent">Urgent</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Mark as Important</InputLabel>
                                    <Select
                                        value={composeForm.is_important ? 'yes' : 'no'}
                                        label="Mark as Important"
                                        onChange={(e) => setComposeForm({ ...composeForm, is_important: e.target.value === 'yes' })}
                                    >
                                        <MenuItem value="no">No</MenuItem>
                                        <MenuItem value="yes">Yes</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <TextField
                            fullWidth
                            label="Message"
                            required
                            multiline
                            rows={10}
                            value={composeForm.body}
                            onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                            placeholder="Type your message here..."
                        />
                    </Box>
                );
        }
    };

    const getDialogTitle = () => {
        const titles: Record<MessageType, { title: string; icon: React.ReactNode }> = {
            email: { title: 'New Email', icon: <EmailIcon /> },
            sms: { title: 'SMS Broadcast', icon: <SmsIcon /> },
            announcement: { title: 'New Announcement', icon: <AnnouncementIcon /> },
            notification: { title: 'Push Notification', icon: <NotifIcon /> },
        };
        return titles[messageType];
    };

    const getSendButtonLabel = () => {
        const labels: Record<MessageType, string> = {
            email: 'Send Email',
            sms: 'Send SMS',
            announcement: 'Post Announcement',
            notification: 'Send Notification',
        };
        return labels[messageType];
    };

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Communication
                    </Typography>
                    <Typography color="text.secondary">
                        Messages, announcements, and notifications ({messages?.total || 0} messages)
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={handleOpenCompose}
                    sx={{ borderRadius: 3 }}
                >
                    Compose
                </Button>
            </Box>

            {/* Quick Actions */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {quickActions.map((action) => (
                    <Grid item xs={6} md={3} key={action.title}>
                        <Card
                            onClick={action.action}
                            sx={{
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 8px 24px ${action.color}40`,
                                },
                            }}
                        >
                            <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                <Avatar
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        background: `${action.color}20`,
                                        color: action.color,
                                        mx: 'auto',
                                        mb: 1,
                                    }}
                                >
                                    {action.icon}
                                </Avatar>
                                <Typography variant="body1" fontWeight={600}>
                                    {action.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {action.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={3}>
                {/* Sidebar */}
                <Grid item xs={12} md={3}>
                    <Card sx={{ p: 0 }}>
                        <Tabs
                            orientation="vertical"
                            value={folder}
                            onChange={handleFolderChange}
                            sx={{ minHeight: 200 }}
                        >
                            <Tab
                                value="inbox"
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'flex-start' }}>
                                        <InboxIcon fontSize="small" />
                                        <span>All Messages</span>
                                        {messages?.unread_count ? (
                                            <Chip label={messages.unread_count} size="small" color="primary" sx={{ ml: 'auto', height: 20 }} />
                                        ) : null}
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start', textAlign: 'left' }}
                            />
                            <Tab
                                value="starred"
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <StarIcon fontSize="small" />
                                        <span>Starred</span>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start' }}
                            />
                            <Tab
                                value="important"
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ImportantIcon fontSize="small" />
                                        <span>Important</span>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start' }}
                            />
                        </Tabs>
                    </Card>
                </Grid>

                {/* Message List */}
                <Grid item xs={12} md={9}>
                    <Card>
                        {/* Search */}
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search messages..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                                }}
                            />
                        </Box>

                        {/* Loading State */}
                        {isLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        )}

                        {/* Error State */}
                        {error && (
                            <Alert severity="error" sx={{ m: 2 }}>
                                Failed to load messages. Please check if backend is running.
                            </Alert>
                        )}

                        {/* Message List */}
                        {!isLoading && !error && messages && (
                            <List sx={{ py: 0 }}>
                                {messages.items.length === 0 ? (
                                    <Box sx={{ p: 6, textAlign: 'center' }}>
                                        <MailIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                                        <Typography variant="h6" color="text.secondary">No messages yet</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Start by sending an email, SMS, or announcement
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<SendIcon />}
                                            onClick={handleOpenCompose}
                                        >
                                            Compose Message
                                        </Button>
                                    </Box>
                                ) : (
                                    messages.items.map((message, index) => (
                                        <React.Fragment key={message.id}>
                                            <ListItem
                                                onClick={() => handleViewMessage(message)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    bgcolor: message.status === 'sent' ? 'action.selected' : 'transparent',
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                    py: 2,
                                                }}
                                                secondaryAction={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {getMessageTypeIcon(message.recipient_type)}
                                                        {message.priority === 'urgent' || message.priority === 'high' ? (
                                                            <UrgentIcon color="error" fontSize="small" />
                                                        ) : null}
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => handleToggleStar(message, e)}
                                                        >
                                                            {message.is_starred ? (
                                                                <StarIcon sx={{ color: '#ffc107' }} />
                                                            ) : (
                                                                <StarBorderIcon />
                                                            )}
                                                        </IconButton>
                                                    </Box>
                                                }
                                            >
                                                <ListItemAvatar>
                                                    <Avatar sx={{
                                                        bgcolor: message.status === 'read' ? 'grey.400' : 'primary.main',
                                                        fontWeight: 600
                                                    }}>
                                                        {(message.sender_name || 'S')[0].toUpperCase()}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 10 }}>
                                                            <Typography
                                                                fontWeight={message.status !== 'read' ? 700 : 400}
                                                                sx={{
                                                                    flex: 1,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {message.subject}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                                                {formatDate(message.sent_at || message.created_at)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            sx={{
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                pr: 10
                                                            }}
                                                        >
                                                            <strong>{message.sender_name || 'System'}</strong> → {message.recipient_name || 'All'} - {message.body?.slice(0, 80)}{message.body?.length > 80 ? '...' : ''}
                                                        </Typography>
                                                    }
                                                />
                                            </ListItem>
                                            {index < messages.items.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))
                                )}
                            </List>
                        )}
                    </Card>
                </Grid>
            </Grid>

            {/* Compose Dialog */}
            <Dialog
                open={openCompose}
                onClose={() => setOpenCompose(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {getDialogTitle().icon}
                    </Avatar>
                    <Typography variant="h6">{getDialogTitle().title}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton onClick={() => setOpenCompose(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {/* Type Selector */}
                    <Tabs
                        value={messageType}
                        onChange={(_, v) => setMessageType(v)}
                        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab value="email" label="Email" icon={<EmailIcon />} iconPosition="start" />
                        <Tab value="sms" label="SMS" icon={<SmsIcon />} iconPosition="start" />
                        <Tab value="announcement" label="Announcement" icon={<AnnouncementIcon />} iconPosition="start" />
                        <Tab value="notification" label="Push" icon={<NotifIcon />} iconPosition="start" />
                    </Tabs>

                    {renderComposeContent()}
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button onClick={() => setOpenCompose(false)} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                        onClick={handleSend}
                        disabled={isSending}
                    >
                        {isSending ? 'Sending...' : getSendButtonLabel()}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* View Message Dialog */}
            <Dialog
                open={openView}
                onClose={handleCloseView}
                maxWidth="md"
                fullWidth
            >
                {selectedMessage && (
                    <>
                        <DialogTitle sx={{ pb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <Box sx={{ flex: 1, pr: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        {getMessageTypeIcon(selectedMessage.recipient_type)}
                                        {selectedMessage.is_important && <ImportantIcon color="warning" fontSize="small" />}
                                        <Chip
                                            label={selectedMessage.priority}
                                            size="small"
                                            color={getPriorityColor(selectedMessage.priority) as any}
                                        />
                                        <Chip
                                            label={selectedMessage.status}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Box>
                                    <Typography variant="h6">{selectedMessage.subject}</Typography>
                                </Box>
                                <IconButton onClick={handleCloseView} size="small">
                                    <CloseIcon />
                                </IconButton>
                            </Box>
                        </DialogTitle>
                        <DialogContent dividers>
                            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                                    {(selectedMessage.sender_name || 'S')[0].toUpperCase()}
                                </Avatar>
                                <Box>
                                    <Typography fontWeight={600} variant="body1">
                                        {selectedMessage.sender_name || 'System'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {selectedMessage.sender_email || 'system@school.edu'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDate(selectedMessage.sent_at || selectedMessage.created_at)}
                                    </Typography>
                                </Box>
                            </Box>

                            {selectedMessage.recipient_name && (
                                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="caption" color="text.secondary">To:</Typography>
                                    <Typography variant="body2">
                                        {selectedMessage.recipient_name} {selectedMessage.recipient_email && `<${selectedMessage.recipient_email}>`}
                                    </Typography>
                                </Box>
                            )}

                            <Divider sx={{ my: 2 }} />

                            <Typography
                                sx={{
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.8,
                                    fontSize: '1rem'
                                }}
                            >
                                {selectedMessage.body}
                            </Typography>
                        </DialogContent>
                        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                            <Button
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDeleteConfirm(selectedMessage.id)}
                            >
                                Delete
                            </Button>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button onClick={handleCloseView}>Close</Button>
                                <Button
                                    startIcon={<ReplyIcon />}
                                    variant="contained"
                                    onClick={() => {
                                        handleCloseView();
                                        setMessageType('email');
                                        setComposeForm({
                                            recipient_name: selectedMessage.sender_name || '',
                                            recipient_email: selectedMessage.sender_email || '',
                                            recipient_type: 'email',
                                            subject: `Re: ${selectedMessage.subject}`,
                                            body: `\n\n---\nOn ${formatDate(selectedMessage.sent_at)}, ${selectedMessage.sender_name} wrote:\n${selectedMessage.body}`,
                                            priority: 'normal',
                                            is_important: false,
                                        });
                                        setOpenCompose(true);
                                    }}
                                >
                                    Reply
                                </Button>
                            </Box>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
                <DialogTitle>Delete Message?</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this message? This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                        disabled={isDeleting}
                        startIcon={isDeleting ? <CircularProgress size={18} /> : <DeleteIcon />}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CommunicationPage;
