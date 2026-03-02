import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, TextField, Button, Switch,
    CircularProgress, Alert
} from '@mui/material';
import {
    SaveRounded as SaveIcon,
    SettingsSuggestRounded as SettingsIcon
} from '@mui/icons-material';
import {
    useGetPlatformSettingsQuery,
    useUpdatePlatformSettingsMutation,
    PlatformSettings,
} from '@/store/api/superAdminApi';

const neuBase = '#f8fafc';
const neuDark = '#c1c8d1';
const neuLight = '#ffffff';

const statShadow = `6px 6px 12px ${neuDark}, -6px -6px 12px ${neuLight}`;
const insetShadow = `inset 4px 4px 8px ${neuDark}, inset -4px -4px 8px ${neuLight}`;

const C = {
    indigo: '#4f46e5',
    amber: '#d97706',
    emerald: '#059669',
    textMain: '#0f172a',
    textMuted: '#475569',
};

const SuperAdminSettingsPage: React.FC = () => {
    const { data: saved, isLoading } = useGetPlatformSettingsQuery();
    const [update, { isLoading: saving }] = useUpdatePlatformSettingsMutation();
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [s, setS] = useState<PlatformSettings>({
        platform_name: 'EduSphere ERP',
        support_email: 'support@eduerp.com',
        maintenance_mode: false,
        allow_new_registrations: true,
        default_plan: 'free',
        max_students_per_tenant: 5000,
        max_staff_per_tenant: 500,
    });

    useEffect(() => { if (saved) setS(saved); }, [saved]);

    const handleSave = async () => {
        try {
            await update(s).unwrap();
            setFeedback({ type: 'success', text: 'All settings have been successfully applied.' });
        } catch (e: any) {
            setFeedback({ type: 'error', text: e.data?.detail || 'Failed to save settings.' });
        }
        setTimeout(() => setFeedback(null), 3500);
    };

    if (isLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress size={40} sx={{ color: C.indigo }} /></Box>;
    }

    const Section = ({ title, children, color = C.indigo }: { title: string; children: React.ReactNode, color?: string }) => (
        <Box sx={{ mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ width: 16, height: 32, bgcolor: color, borderRadius: '8px', boxShadow: statShadow, border: '1px solid #ffffff' }} />
                <Typography variant="h4" fontWeight={900} sx={{ color: C.textMain, letterSpacing: '-0.5px', textShadow: '1px 1px 2px rgba(0,0,0,0.05)' }}>
                    {title}
                </Typography>
            </Box>
            <Box sx={{
                bgcolor: neuBase, p: { xs: 3, md: 5 }, borderRadius: '24px',
                mx: 0.5, // keep it slightly off the edge
                boxShadow: statShadow, border: '1px solid #ffffff'
            }}>
                {children}
            </Box>
        </Box>
    );

    const inputStyles = {
        '& .MuiOutlinedInput-root': {
            borderRadius: '16px',
            bgcolor: neuBase,
            boxShadow: insetShadow,
            '& fieldset': { border: 'none' },
            '& input': { color: C.textMain, fontWeight: 800, fontSize: '1.05rem', p: 2 }
        },
        '& .MuiInputLabel-root': { fontWeight: 900, color: C.textMuted }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{
                        width: 70, height: 70, borderRadius: '20px',
                        background: 'linear-gradient(145deg, #d97706, #b45309)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '6px 6px 12px #c1c8d1, -6px -6px 12px #ffffff',
                        border: '2px solid #d97706'
                    }}>
                        <SettingsIcon fontSize="large" sx={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))' }} />
                    </Box>
                    <Box>
                        <Typography variant="h3" fontWeight={900} sx={{ color: C.textMain, letterSpacing: '-1px', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                            Configuration
                        </Typography>
                        <Typography variant="h6" sx={{ color: C.textMuted, fontWeight: 700, mt: 0.5 }}>
                            Physical switches & deeply visible limits.
                        </Typography>
                    </Box>
                </Box>

                <Button
                    variant="contained" disableElevation
                    startIcon={<SaveIcon />}
                    onClick={handleSave} disabled={saving}
                    sx={{
                        borderRadius: '16px', textTransform: 'none', fontWeight: 900, px: 4, py: 1.5, fontSize: '1rem',
                        background: 'linear-gradient(145deg, #4f46e5, #4338ca)', color: 'white',
                        boxShadow: '6px 6px 12px #c1c8d1, -6px -6px 12px #ffffff',
                        border: '1px solid #4f46e5',
                        '&:hover': { boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.2)' },
                    }}
                >
                    {saving ? 'Engaging...' : 'Push Configuration'}
                </Button>
            </Box>

            {feedback && (
                <Alert severity={feedback.type} sx={{
                    mb: 5, borderRadius: '16px', fontWeight: 900,
                    boxShadow: insetShadow, border: '1px solid #ffffff',
                    bgcolor: neuBase, color: feedback.type === 'success' ? C.emerald : C.rose,
                    '& .MuiAlert-icon': { color: feedback.type === 'success' ? C.emerald : C.rose }
                }}>
                    {feedback.text}
                </Alert>
            )}

            <Section title="Identity & Branding" color={C.indigo}>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <TextField label="Global Platform Title" fullWidth value={s.platform_name}
                            onChange={e => setS({ ...s, platform_name: e.target.value })} sx={inputStyles} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField label="Central Support Contact" fullWidth value={s.support_email}
                            onChange={e => setS({ ...s, support_email: e.target.value })} sx={inputStyles} />
                    </Grid>
                </Grid>
            </Section>

            <Section title="Enforced Ceilings" color={C.amber}>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <TextField type="number" label="Max Permitted Students" fullWidth value={s.max_students_per_tenant}
                            onChange={e => setS({ ...s, max_students_per_tenant: +e.target.value })} sx={inputStyles}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField type="number" label="Max Permitted Staff" fullWidth value={s.max_staff_per_tenant}
                            onChange={e => setS({ ...s, max_staff_per_tenant: +e.target.value })} sx={inputStyles}
                        />
                    </Grid>
                </Grid>
            </Section>

            <Section title="Core Capabilities" color={C.emerald}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', p: { xs: 3, md: 4 }, bgcolor: neuBase, borderRadius: '20px', boxShadow: statShadow, border: '1px solid #ffffff' }}>
                        <Box sx={{ pr: 3 }}>
                            <Typography fontWeight={900} fontSize="1.3rem" sx={{ color: C.textMain }}>System Maintenance Lock</Typography>
                            <Typography variant="body1" sx={{ color: C.textMuted, fontWeight: 700, mt: 0.5 }}>Block all non-superadmin logins globally.</Typography>
                        </Box>
                        <Switch
                            checked={s.maintenance_mode}
                            onChange={e => setS({ ...s, maintenance_mode: e.target.checked })}
                            sx={{
                                width: 62, height: 38, p: 0,
                                '& .MuiSwitch-switchBase': { p: '4px', bgcolor: 'transparent', '&.Mui-checked': { transform: 'translateX(24px)', color: C.amber, '& + .MuiSwitch-track': { bgcolor: neuBase, opacity: 1, boxShadow: insetShadow } } },
                                '& .MuiSwitch-thumb': { width: 30, height: 30, boxShadow: statShadow },
                                '& .MuiSwitch-track': { borderRadius: '20px', bgcolor: neuBase, boxShadow: insetShadow, opacity: 1, border: '1px solid #ffffff' }
                            }}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', p: { xs: 3, md: 4 }, bgcolor: neuBase, borderRadius: '20px', boxShadow: statShadow, border: '1px solid #ffffff' }}>
                        <Box sx={{ pr: 3 }}>
                            <Typography fontWeight={900} fontSize="1.3rem" sx={{ color: C.textMain }}>Self-Service Enrollment</Typography>
                            <Typography variant="body1" sx={{ color: C.textMuted, fontWeight: 700, mt: 0.5 }}>Permit public users to provision new instances.</Typography>
                        </Box>
                        <Switch
                            checked={s.allow_new_registrations}
                            onChange={e => setS({ ...s, allow_new_registrations: e.target.checked })}
                            sx={{
                                width: 62, height: 38, p: 0,
                                '& .MuiSwitch-switchBase': { p: '4px', bgcolor: 'transparent', '&.Mui-checked': { transform: 'translateX(24px)', color: C.indigo, '& + .MuiSwitch-track': { bgcolor: neuBase, opacity: 1, boxShadow: insetShadow } } },
                                '& .MuiSwitch-thumb': { width: 30, height: 30, boxShadow: statShadow },
                                '& .MuiSwitch-track': { borderRadius: '20px', bgcolor: neuBase, boxShadow: insetShadow, opacity: 1, border: '1px solid #ffffff' }
                            }}
                        />
                    </Box>
                </Box>
            </Section>
        </Box>
    );
};

export default SuperAdminSettingsPage;
