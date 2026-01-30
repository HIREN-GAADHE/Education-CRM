import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Card, CardContent, Tabs, Tab, Divider, Switch,
    Grid, Select, MenuItem, FormControl, InputLabel, Button, Alert, Snackbar,
    CircularProgress, TextField, Slider, Avatar, Tooltip, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { selectTheme, setTheme, setPrimaryColor, setSidebarCollapsed, setInstitutionDetails } from '@/store/slices/uiSlice';
import { selectToken } from '@/store/slices/authSlice';
import {
    Save as SaveIcon,
    Refresh as RefreshIcon,
    Business as BusinessIcon,
    Palette as PaletteIcon,
    Notifications as NotificationsIcon,
    Security as SecurityIcon,
    Settings as SettingsIcon,
    School as SchoolIcon,
    CloudDownload as CloudDownloadIcon,
    RestartAlt as ResetIcon,
    PhotoCamera as CameraIcon,
    Download as DownloadIcon,
    Storage as StorageIcon
} from '@mui/icons-material';
import {
    useGetSettingsQuery,
    useUpdateSettingsMutation,
    useResetSettingsMutation,
    useUploadInstitutionLogoMutation,
    SettingsUpdateRequest,
} from '../store/api/settingsApi';
import { toast } from 'react-toastify';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <div hidden={value !== index}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const SettingsPage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const dispatch = useDispatch();
    const themeMode = useSelector(selectTheme);

    // API Queries
    const { data: settings, isLoading, error, refetch } = useGetSettingsQuery();
    const [updateSettings, { isLoading: isSaving }] = useUpdateSettingsMutation();
    const [resetSettings, { isLoading: isResetting }] = useResetSettingsMutation();

    // Dialogs
    const [resetDialogOpen, setResetDialogOpen] = useState(false);

    // Local state for form
    const [localSettings, setLocalSettings] = useState<SettingsUpdateRequest>({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // Initialize local state when settings are loaded
    useEffect(() => {
        if (settings) {
            setLocalSettings({
                appearance: {
                    theme: settings.appearance.theme,
                    primary_color: settings.appearance.primary_color,
                    sidebar_collapsed: settings.appearance.sidebar_collapsed,
                    language: settings.appearance.language,
                    timezone: settings.appearance.timezone,
                },
                system: {
                    date_format: settings.system.date_format,
                    time_format: settings.system.time_format,
                    currency: settings.system.currency,
                    currency_symbol: settings.system.currency_symbol,
                    academic_year: settings.system.academic_year,
                    grading_system: settings.system.grading_system,
                },
                notifications: {
                    email_notifications: settings.notifications.email_notifications,
                    push_notifications: settings.notifications.push_notifications,
                    sms_alerts: settings.notifications.sms_alerts,
                    weekly_digest: settings.notifications.weekly_digest,
                },
                security: {
                    two_factor_enabled: settings.security.two_factor_enabled,
                    session_timeout_minutes: settings.security.session_timeout_minutes,
                    login_notifications: settings.security.login_notifications,
                    api_access_enabled: settings.security.api_access_enabled,
                    password_expiry_days: settings.security.password_expiry_days,
                },
                institution: {
                    institution_name: settings.institution.institution_name,
                    institution_logo_url: settings.institution.institution_logo_url,
                    institution_address: settings.institution.institution_address,
                    institution_phone: settings.institution.institution_phone,
                    institution_email: settings.institution.institution_email,
                    institution_website: settings.institution.institution_website,
                },
            });
        }
    }, [settings]);

    const handleSaveSettings = async () => {
        try {
            await updateSettings(localSettings).unwrap();
            setSnackbar({ open: true, message: 'Settings saved successfully!', severity: 'success' });

            // Sync all appearance settings with Redux for portal-wide application
            if (localSettings.appearance) {
                // Sync theme
                if (localSettings.appearance.theme) {
                    const newTheme = localSettings.appearance.theme as 'light' | 'dark';
                    if (newTheme !== themeMode) {
                        dispatch(setTheme(newTheme));
                    }
                }

                // Sync primary color
                if (localSettings.appearance.primary_color) {
                    dispatch(setPrimaryColor(localSettings.appearance.primary_color));
                }

                // Sync sidebar collapsed state
                if (localSettings.appearance.sidebar_collapsed !== undefined && localSettings.appearance.sidebar_collapsed !== null) {
                    dispatch(setSidebarCollapsed(localSettings.appearance.sidebar_collapsed));
                }
            }

            // Update institution details in Redux
            if (localSettings.institution) {
                dispatch(setInstitutionDetails({
                    name: localSettings.institution.institution_name || undefined,
                }));
            }
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
        }
    };

    const handleResetSettings = async () => {
        try {
            const resetResult = await resetSettings().unwrap();
            setResetDialogOpen(false);
            refetch();

            // Sync default appearance settings to Redux immediately
            dispatch(setTheme((resetResult.appearance.theme as 'light' | 'dark') || 'light'));
            dispatch(setPrimaryColor(resetResult.appearance.primary_color || '#667eea'));
            dispatch(setSidebarCollapsed(resetResult.appearance.sidebar_collapsed ?? false));
            dispatch(setInstitutionDetails({
                name: resetResult.institution.institution_name || undefined,
                logoUrl: resetResult.institution.institution_logo_url || undefined,
            }));

            toast.success('Settings reset to defaults!');
        } catch (err) {
            toast.error('Failed to reset settings');
        }
    };

    const handleChange = (category: string, key: string, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            [category]: { ...(prev as any)[category], [key]: value }
        }));
    };

    // Logo upload
    const [uploadLogo, { isLoading: isUploadingLogo }] = useUploadInstitutionLogoMutation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                // Check file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    toast.error('File larger than 2MB');
                    return;
                }

                await uploadLogo(file).unwrap();
                toast.success('Logo uploaded successfully!');

                // Refresh settings to show new logo and update Redux
                const result = await refetch();
                if (result.data?.institution?.institution_logo_url) {
                    dispatch(setInstitutionDetails({ logoUrl: result.data.institution.institution_logo_url }));
                }
            } catch (err) {
                toast.error('Failed to upload logo');
            }
        }
    };

    // Exports
    const token = useSelector(selectToken);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

    const handleExportData = async (type: string) => {
        const loadingToast = toast.loading(`Exporting ${type} data...`);
        try {
            let endpoint = '';
            let filename = '';

            switch (type) {
                case 'students':
                    endpoint = '/import-export/export/students?format=csv';
                    filename = 'students_export.csv';
                    break;
                case 'fees':
                    endpoint = '/import-export/export/fees';
                    filename = 'fees_export.csv';
                    break;
                case 'attendance':
                    endpoint = '/import-export/export/attendance';
                    filename = 'attendance_export.csv';
                    break;
                default:
                    throw new Error('Unknown export type');
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Export failed');

            // Download file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.dismiss(loadingToast);
            toast.success(`${type} exported successfully!`);
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error(`Failed to export ${type} data`);
            console.error(err);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" action={
                    <Button color="inherit" size="small" onClick={() => refetch()}>
                        Retry
                    </Button>
                }>
                    Failed to load settings. Please try again.
                </Alert>
            </Box>
        );
    }

    const tabs = [
        { label: 'Institution', icon: <BusinessIcon /> },
        { label: 'Appearance', icon: <PaletteIcon /> },
        { label: 'Notifications', icon: <NotificationsIcon /> },
        { label: 'Security', icon: <SecurityIcon /> },
        { label: 'System', icon: <SettingsIcon /> },
        { label: 'Data & Backup', icon: <CloudDownloadIcon /> },
    ];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" gutterBottom sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Settings
                    </Typography>
                    <Typography color="text.secondary">
                        Configure your application preferences and institution settings
                    </Typography>
                </Box>
                <Box>
                    <Tooltip title="Reset to defaults">
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<ResetIcon />}
                            onClick={() => setResetDialogOpen(true)}
                            sx={{ mr: 1 }}
                        >
                            Reset
                        </Button>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => refetch()}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            <Card>
                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        px: 2,
                        '& .MuiTab-root': {
                            fontWeight: 600,
                            minHeight: 64,
                        },
                    }}
                >
                    {tabs.map((tab, index) => (
                        <Tab key={index} icon={tab.icon} label={tab.label} iconPosition="start" />
                    ))}
                </Tabs>

                {/* Institution Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Institution Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Configure your institution's basic information that appears on reports and documents.
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Avatar
                                    src={localSettings.institution?.institution_logo_url || undefined}
                                    sx={{
                                        width: 120,
                                        height: 120,
                                        mb: 2,
                                        border: '3px solid',
                                        borderColor: 'primary.main',
                                    }}
                                >
                                    <BusinessIcon sx={{ fontSize: 60 }} />
                                </Avatar>
                                <Button
                                    variant="outlined"
                                    startIcon={<CameraIcon />}
                                    size="small"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingLogo}
                                >
                                    {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                />
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={9}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Institution Name"
                                        value={localSettings.institution?.institution_name || ''}
                                        onChange={(e) => handleChange('institution', 'institution_name', e.target.value)}
                                        placeholder="Enter your institution name"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Email"
                                        type="email"
                                        value={localSettings.institution?.institution_email || ''}
                                        onChange={(e) => handleChange('institution', 'institution_email', e.target.value)}
                                        placeholder="info@institution.edu"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Phone"
                                        value={localSettings.institution?.institution_phone || ''}
                                        onChange={(e) => handleChange('institution', 'institution_phone', e.target.value)}
                                        placeholder="+91 1234567890"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Website"
                                        value={localSettings.institution?.institution_website || ''}
                                        onChange={(e) => handleChange('institution', 'institution_website', e.target.value)}
                                        placeholder="https://www.institution.edu"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        label="Address"
                                        value={localSettings.institution?.institution_address || ''}
                                        onChange={(e) => handleChange('institution', 'institution_address', e.target.value)}
                                        placeholder="Enter complete address"
                                    />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </TabPanel>

                {/* Appearance Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Appearance Settings
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card sx={{ p: 2, background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="body1" fontWeight={600}>Dark Mode</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Toggle dark/light theme
                                        </Typography>
                                    </Box>
                                    <Switch
                                        checked={localSettings.appearance?.theme === 'dark'}
                                        onChange={(e) => handleChange('appearance', 'theme', e.target.checked ? 'dark' : 'light')}
                                        sx={{
                                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' },
                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#667eea' },
                                        }}
                                    />
                                </Box>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card sx={{ p: 2, background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="body1" fontWeight={600}>Compact Sidebar</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Show sidebar in collapsed mode
                                        </Typography>
                                    </Box>
                                    <Switch
                                        checked={localSettings.appearance?.sidebar_collapsed ?? false}
                                        onChange={(e) => handleChange('appearance', 'sidebar_collapsed', e.target.checked)}
                                    />
                                </Box>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Language</InputLabel>
                                <Select
                                    value={localSettings.appearance?.language ?? 'en'}
                                    label="Language"
                                    onChange={(e) => handleChange('appearance', 'language', e.target.value)}
                                >
                                    <MenuItem value="en">English</MenuItem>
                                    <MenuItem value="hi">हिंदी</MenuItem>
                                    <MenuItem value="gu">ગુજરાતી</MenuItem>
                                    <MenuItem value="mr">मराठी</MenuItem>
                                    <MenuItem value="ta">தமிழ்</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Timezone</InputLabel>
                                <Select
                                    value={localSettings.appearance?.timezone ?? 'Asia/Kolkata'}
                                    label="Timezone"
                                    onChange={(e) => handleChange('appearance', 'timezone', e.target.value)}
                                >
                                    <MenuItem value="Asia/Kolkata">Asia/Kolkata (IST)</MenuItem>
                                    <MenuItem value="UTC">UTC</MenuItem>
                                    <MenuItem value="America/New_York">America/New_York (EST)</MenuItem>
                                    <MenuItem value="America/Los_Angeles">America/Los_Angeles (PST)</MenuItem>
                                    <MenuItem value="Europe/London">Europe/London (GMT)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="body2" fontWeight={600} gutterBottom>
                                Primary Color
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                                    <Box
                                        key={color}
                                        onClick={() => handleChange('appearance', 'primary_color', color)}
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 2,
                                            bgcolor: color,
                                            cursor: 'pointer',
                                            border: localSettings.appearance?.primary_color === color ? '3px solid white' : 'none',
                                            boxShadow: localSettings.appearance?.primary_color === color ? `0 0 0 2px ${color}` : 'none',
                                            '&:hover': { transform: 'scale(1.1)' },
                                            transition: 'all 0.2s',
                                        }}
                                    />
                                ))}
                            </Box>
                        </Grid>
                    </Grid>
                </TabPanel>

                {/* Notifications Tab */}
                <TabPanel value={tabValue} index={2}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Notification Preferences
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={2}>
                        {[
                            { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                            { key: 'push_notifications', label: 'Push Notifications', desc: 'Browser push notifications' },
                            { key: 'sms_alerts', label: 'SMS Alerts', desc: 'Critical alerts via SMS' },
                            { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Weekly summary report' },
                        ].map((item) => (
                            <Grid item xs={12} md={6} key={item.key}>
                                <Card sx={{ p: 2, background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box>
                                            <Typography variant="body1" fontWeight={600}>{item.label}</Typography>
                                            <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                                        </Box>
                                        <Switch
                                            checked={(localSettings.notifications as any)?.[item.key] ?? false}
                                            onChange={(e) => handleChange('notifications', item.key, e.target.checked)}
                                        />
                                    </Box>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </TabPanel>

                {/* Security Tab */}
                <TabPanel value={tabValue} index={3}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Security Settings
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        {[
                            { key: 'two_factor_enabled', label: 'Two-Factor Authentication', desc: 'Extra layer of security for logins' },
                            { key: 'login_notifications', label: 'Login Notifications', desc: 'Get alerted on new logins to your account' },
                            { key: 'api_access_enabled', label: 'API Access', desc: 'Allow API token access for integrations' },
                        ].map((item) => (
                            <Grid item xs={12} md={6} key={item.key}>
                                <Card sx={{ p: 2, background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box>
                                            <Typography variant="body1" fontWeight={600}>{item.label}</Typography>
                                            <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                                        </Box>
                                        <Switch
                                            checked={(localSettings.security as any)?.[item.key] ?? false}
                                            onChange={(e) => handleChange('security', item.key, e.target.checked)}
                                        />
                                    </Box>
                                </Card>
                            </Grid>
                        ))}

                        <Grid item xs={12} md={6}>
                            <Card sx={{ p: 3, background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                <Typography variant="body1" fontWeight={600} gutterBottom>
                                    Session Timeout
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Automatically log out after inactivity: {localSettings.security?.session_timeout_minutes || 30} minutes
                                </Typography>
                                <Slider
                                    value={localSettings.security?.session_timeout_minutes ?? 30}
                                    onChange={(_, value) => handleChange('security', 'session_timeout_minutes', value)}
                                    min={5}
                                    max={120}
                                    step={5}
                                    marks={[
                                        { value: 5, label: '5m' },
                                        { value: 30, label: '30m' },
                                        { value: 60, label: '1h' },
                                        { value: 120, label: '2h' },
                                    ]}
                                    sx={{ color: '#667eea' }}
                                />
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card sx={{ p: 3, background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                <Typography variant="body1" fontWeight={600} gutterBottom>
                                    Password Expiry
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Require password change every: {localSettings.security?.password_expiry_days || 90} days
                                </Typography>
                                <Slider
                                    value={localSettings.security?.password_expiry_days ?? 90}
                                    onChange={(_, value) => handleChange('security', 'password_expiry_days', value)}
                                    min={30}
                                    max={365}
                                    step={30}
                                    marks={[
                                        { value: 30, label: '30d' },
                                        { value: 90, label: '90d' },
                                        { value: 180, label: '180d' },
                                        { value: 365, label: '1yr' },
                                    ]}
                                    sx={{ color: '#667eea' }}
                                />
                            </Card>
                        </Grid>
                    </Grid>
                </TabPanel>

                {/* System Tab */}
                <TabPanel value={tabValue} index={4}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        System Settings
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Alert severity="info" icon={<SchoolIcon />} sx={{ mb: 2 }}>
                                <strong>Academic Settings</strong> - These settings affect grade calculations and academic reports.
                            </Alert>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Academic Year</InputLabel>
                                <Select
                                    value={localSettings.system?.academic_year ?? '2025-26'}
                                    label="Academic Year"
                                    onChange={(e) => handleChange('system', 'academic_year', e.target.value)}
                                >
                                    <MenuItem value="2024-25">2024-25</MenuItem>
                                    <MenuItem value="2025-26">2025-26</MenuItem>
                                    <MenuItem value="2026-27">2026-27</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Grading System</InputLabel>
                                <Select
                                    value={localSettings.system?.grading_system ?? 'percentage'}
                                    label="Grading System"
                                    onChange={(e) => handleChange('system', 'grading_system', e.target.value)}
                                >
                                    <MenuItem value="percentage">Percentage (%)</MenuItem>
                                    <MenuItem value="cgpa">CGPA (10-point)</MenuItem>
                                    <MenuItem value="letter">Letter Grades (A-F)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Format & Currency
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Date Format</InputLabel>
                                <Select
                                    value={localSettings.system?.date_format ?? 'DD/MM/YYYY'}
                                    label="Date Format"
                                    onChange={(e) => handleChange('system', 'date_format', e.target.value)}
                                >
                                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</MenuItem>
                                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</MenuItem>
                                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Time Format</InputLabel>
                                <Select
                                    value={localSettings.system?.time_format ?? '12h'}
                                    label="Time Format"
                                    onChange={(e) => handleChange('system', 'time_format', e.target.value)}
                                >
                                    <MenuItem value="12h">12-Hour (2:30 PM)</MenuItem>
                                    <MenuItem value="24h">24-Hour (14:30)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Currency</InputLabel>
                                <Select
                                    value={localSettings.system?.currency ?? 'INR'}
                                    label="Currency"
                                    onChange={(e) => {
                                        const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
                                        handleChange('system', 'currency', e.target.value);
                                        handleChange('system', 'currency_symbol', symbols[e.target.value as string] || '₹');
                                    }}
                                >
                                    <MenuItem value="INR">₹ INR (Indian Rupee)</MenuItem>
                                    <MenuItem value="USD">$ USD (US Dollar)</MenuItem>
                                    <MenuItem value="EUR">€ EUR (Euro)</MenuItem>
                                    <MenuItem value="GBP">£ GBP (British Pound)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </TabPanel>

                {/* Data & Backup Tab */}
                <TabPanel value={tabValue} index={5}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Data & Backup
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Alert severity="info" icon={<StorageIcon />}>
                                Manage your data exports and backups. Export data in CSV format for external use.
                            </Alert>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Card sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
                                <DownloadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>Export Students</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Download all student records as CSV
                                </Typography>
                                <Button variant="contained" onClick={() => handleExportData('students')}>
                                    Export
                                </Button>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Card sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
                                <DownloadIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>Export Fees</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Download fee records & payments
                                </Typography>
                                <Button variant="contained" color="success" onClick={() => handleExportData('fees')}>
                                    Export
                                </Button>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Card sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
                                <DownloadIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>Export Attendance</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Download attendance records
                                </Typography>
                                <Button variant="contained" color="warning" onClick={() => handleExportData('attendance')}>
                                    Export
                                </Button>
                            </Card>
                        </Grid>

                        <Grid item xs={12}>
                            <Card sx={{ p: 3, bgcolor: 'action.hover' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <StorageIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight={600}>
                                                Database Status
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Last backup: Never (Automatic backups not configured)
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Chip label="Healthy" color="success" />
                                </Box>
                            </Card>
                        </Grid>
                    </Grid>
                </TabPanel>

                {/* Save Button */}
                <CardContent sx={{ borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            sx={{
                                borderRadius: 2,
                                px: 4,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Save All Settings'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Reset Confirmation Dialog */}
            <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
                <DialogTitle>Reset Settings to Defaults?</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will reset ALL settings to their default values. This action cannot be undone.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={handleResetSettings}
                        disabled={isResetting}
                    >
                        {isResetting ? 'Resetting...' : 'Reset Settings'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SettingsPage;
