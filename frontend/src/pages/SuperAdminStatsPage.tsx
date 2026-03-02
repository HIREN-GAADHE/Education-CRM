import React from 'react';
import {
    Box, Grid, Typography, CircularProgress, Chip
} from '@mui/material';
import { useGetGlobalStatsQuery, useGetTenantsQuery } from '@/store/api/superAdminApi';
import {
    CorporateFareRounded,
    SettingsApplicationsRounded,
    PeopleAltRounded,
    SchoolRounded,
    BadgeRounded,
    WarningRounded
} from '@mui/icons-material';

const neuBase = '#f8fafc';
const neuDark = '#c1c8d1';
const neuLight = '#ffffff';

const statShadow = `6px 6px 12px ${neuDark}, -6px -6px 12px ${neuLight}`;
const insetShadow = `inset 4px 4px 8px ${neuDark}, inset -4px -4px 8px ${neuLight}`;

const C = {
    indigo: '#4f46e5',
    sky: '#0284c7',
    emerald: '#059669',
    amber: '#d97706',
    rose: '#e11d48',
    violet: '#7c3aed',
    textMain: '#0f172a',
    textMuted: '#475569',
};

const StatBox = ({ value, label, color, icon }: { value: number | string; label: string; color: string; icon: React.ReactNode }) => (
    <Box sx={{
        bgcolor: neuBase,
        borderRadius: '24px', p: { xs: 2.5, md: 3 },
        mx: 0.5, my: 0.5, // keep it slightly off the edge so shadows don't clip
        boxShadow: statShadow,
        border: '1px solid #ffffff',
        display: 'flex', flexDirection: 'column', height: '100%',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-2px)' }
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box sx={{
                width: 52, height: 52, borderRadius: '16px',
                bgcolor: neuBase, color: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: statShadow, border: '1px solid #ffffff'
            }}>
                {icon}
            </Box>
            <Typography variant="body1" sx={{ color: color, fontWeight: 900 }}>
                {label}
            </Typography>
        </Box>
        <Typography variant="h3" fontWeight={900} sx={{ color: C.textMain, letterSpacing: '-1px', textShadow: '1px 1px 2px rgba(0,0,0,0.1)' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
    </Box>
);

const SuperAdminStatsPage: React.FC = () => {
    const { data: gs, isLoading: sL } = useGetGlobalStatsQuery();
    const { data: tenants, isLoading: tL } = useGetTenantsQuery();

    if (sL || tL) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress size={40} sx={{ color: C.indigo }} /></Box>;
    }

    const sorted = [...(tenants || [])].sort((a, b) => (b.total_students || 0) - (a.total_students || 0));

    const DataRow = ({ label, val, c }: any) => (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderRadius: '16px', bgcolor: neuBase, boxShadow: insetShadow, mb: 1.5 }}>
            <Typography variant="body2" sx={{ color: C.textMain, fontWeight: 900 }}>{label}</Typography>
            <Typography variant="body1" sx={{ color: c, fontWeight: 900 }}>{val}</Typography>
        </Box>
    );

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{
                    width: 70, height: 70, borderRadius: '20px',
                    background: 'linear-gradient(145deg, #059669, #047857)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '6px 6px 12px #c1c8d1, -6px -6px 12px #ffffff',
                    border: '2px solid #059669'
                }}>
                    <SettingsApplicationsRounded fontSize="large" sx={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))' }} />
                </Box>
                <Box>
                    <Typography variant="h3" fontWeight={900} sx={{ color: C.textMain, letterSpacing: '-1px', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                        Platform Analytics
                    </Typography>
                    <Typography variant="h6" sx={{ color: C.textMuted, fontWeight: 700, mt: 0.5 }}>
                        High-contrast structural visualization.
                    </Typography>
                </Box>
            </Box>

            <Grid container spacing={3} sx={{ mb: 6 }}>
                {[
                    { value: gs?.total_tenants || 0, label: 'Deployments', color: C.indigo, icon: <CorporateFareRounded /> },
                    { value: gs?.active_tenants || 0, label: 'Active', color: C.emerald, icon: <CorporateFareRounded /> },
                    { value: gs?.total_users_platform || 0, label: 'Combined Users', color: C.sky, icon: <PeopleAltRounded /> },
                    { value: gs?.total_students_platform || 0, label: 'Students Central', color: C.amber, icon: <SchoolRounded /> },
                    { value: gs?.total_staff_platform || 0, label: 'Total Educators', color: C.violet, icon: <BadgeRounded /> },
                    { value: (gs?.total_tenants || 0) - (gs?.active_tenants || 0), label: 'Suspended Orgs', color: C.rose, icon: <WarningRounded /> },
                ].map((s, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                        <StatBox {...s} />
                    </Grid>
                ))}
            </Grid>

            <Typography variant="h4" fontWeight={900} sx={{ color: C.textMain, mb: 4, textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                Volume by Instance
            </Typography>

            <Grid container spacing={3}>
                {sorted.slice(0, 12).map((t) => {
                    const active = t.status === 'active';
                    return (
                        <Grid item xs={12} sm={6} md={4} key={t.id}>
                            <Box sx={{
                                bgcolor: neuBase, borderRadius: '24px', p: 3, pb: 1.5,
                                mx: 0.5, my: 0.5,
                                boxShadow: statShadow,
                                border: '1px solid #ffffff',
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'translateY(-2px)' }
                            }}>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography fontWeight={900} fontSize="1.3rem" noWrap sx={{ color: C.textMain, maxWidth: '65%', textShadow: '1px 1px 2px rgba(0,0,0,0.05)' }}>
                                        {t.name}
                                    </Typography>
                                    <Chip
                                        label={t.status}
                                        sx={{
                                            fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1,
                                            height: 32, px: 1,
                                            bgcolor: neuBase,
                                            boxShadow: active ? insetShadow : statShadow,
                                            color: active ? C.emerald : C.rose, borderRadius: '12px', border: '1px solid #ffffff'
                                        }}
                                    />
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <DataRow label="Total Users" val={t.total_users.toLocaleString()} c={C.sky} />
                                    <DataRow label="Total Students" val={(t.total_students || 0).toLocaleString()} c={C.amber} />
                                    <DataRow label="Total Staff" val={(t.total_staff || 0).toLocaleString()} c={C.violet} />
                                </Box>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
};

export default SuperAdminStatsPage;
