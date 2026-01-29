import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    TextField,
    Button,
    Switch,
    FormControlLabel,
    Divider,
    Alert
} from '@mui/material';

const SuperAdminSettingsPage: React.FC = () => {
    const [settings, setSettings] = useState({
        platformName: 'EduSphere ERP',
        maintenanceMode: false,
        allowNewRegistrations: true,
        defaultPlan: 'free',
        supportEmail: 'support@eduerp.com'
    });
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        // TODO: Implement API call to save settings
        console.log('Saving settings:', settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 4 }}>Platform Settings</Typography>

            {saved && <Alert severity="success" sx={{ mb: 3 }}>Settings saved successfully!</Alert>}

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>General Settings</Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Platform Name"
                            fullWidth
                            value={settings.platformName}
                            onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Support Email"
                            fullWidth
                            value={settings.supportEmail}
                            onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Default Plan for New Universities"
                            fullWidth
                            value={settings.defaultPlan}
                            onChange={(e) => setSettings({ ...settings, defaultPlan: e.target.value })}
                        />
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Feature Toggles</Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={settings.maintenanceMode}
                                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                                    color="warning"
                                />
                            }
                            label="Maintenance Mode (Disables all tenant access)"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={settings.allowNewRegistrations}
                                    onChange={(e) => setSettings({ ...settings, allowNewRegistrations: e.target.checked })}
                                />
                            }
                            label="Allow New University Registrations"
                        />
                    </Grid>
                </Grid>
            </Paper>

            <Button variant="contained" size="large" onClick={handleSave}>
                Save Settings
            </Button>
        </Box>
    );
};

export default SuperAdminSettingsPage;
