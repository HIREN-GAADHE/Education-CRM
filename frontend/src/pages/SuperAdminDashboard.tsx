import React, { useState, useMemo } from 'react';
import {
    Box, Grid, Typography, Button, CircularProgress,
    TextField, MenuItem, InputAdornment, Alert, Chip,
} from '@mui/material';
import {
    AddRounded as AddIcon,
    SearchRounded as SearchIcon,
    CorporateFareRounded as BusinessIcon,
    GroupRounded as PeopleIcon,
    SchoolRounded as SchoolIcon,
    BadgeRounded as StaffIcon,
} from '@mui/icons-material';
import {
    useGetGlobalStatsQuery,
    useGetTenantsQuery,
    useUpdateTenantMutation,
    TenantStats
} from '@/store/api/superAdminApi';

import TenantTable from '../components/features/super-admin/TenantTable';
import CreateTenantDialog from '../components/features/super-admin/dialogs/CreateTenantDialog';
import ManageAdminDialog from '../components/features/super-admin/dialogs/ManageAdminDialog';
import DeleteConfirmDialog from '../components/features/super-admin/dialogs/DeleteConfirmDialog';
import ModuleAccessDialog from '../components/features/super-admin/dialogs/ModuleAccessDialog';

const neuBase = '#f8fafc';
const neuDark = '#c1c8d1';
const neuLight = '#ffffff';

// softened the shadows severely to prevent them from eating into grid margins
const statShadow = `6px 6px 12px ${neuDark}, -6px -6px 12px ${neuLight}`;
const insetShadow = `inset 4px 4px 8px ${neuDark}, inset -4px -4px 8px ${neuLight}`;

const C = {
    indigo: '#4f46e5',
    sky: '#0284c7',
    emerald: '#059669',
    amber: '#d97706',
    rose: '#e11d48',
    textMain: '#0f172a',
    textMuted: '#475569',
};

const StatCard = ({
    value, label, subtitle, color, icon
}: {
    value: number | string; label: string; subtitle?: string; color: string; icon: React.ReactNode;
}) => (
    <Box sx={{
        bgcolor: neuBase,
        borderRadius: '24px',
        p: { xs: 2.5, md: 3 }, // robust internal padding
        mx: 0.5, // keep cards slightly in from grid line so shadows don't clip
        my: 0.5,
        boxShadow: statShadow,
        border: '1px solid #ffffff',
        display: 'flex', flexDirection: 'column', height: '100%',
        minHeight: 160,
        transition: 'transform 0.2s',
        '&:hover': {
            transform: 'translateY(-2px)',
        }
    }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{
                width: 52, height: 52, borderRadius: '16px',
                bgcolor: neuBase, color: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: statShadow, border: '1px solid #ffffff'
            }}>
                {icon}
            </Box>
            <Typography variant="h3" fontWeight={900} sx={{ color: C.textMain, m: 0, lineHeight: 1, textShadow: '1px 1px 2px rgba(0,0,0,0.1)' }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
        </Box>

        <Box sx={{ mt: 'auto' }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: color, mb: 0.5 }}>
                {label}
            </Typography>
            {subtitle && (
                <Typography variant="body2" sx={{ color: C.textMuted, fontWeight: 600 }}>
                    {subtitle}
                </Typography>
            )}
        </Box>
    </Box>
);

const SuperAdminDashboard: React.FC = () => {
    const { data: gs, isLoading: sL } = useGetGlobalStatsQuery();
    const { data: tenants, isLoading: tL, refetch } = useGetTenantsQuery();
    const [updateTenant] = useUpdateTenantMutation();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [msg, setMsg] = useState<string | null>(null);

    const [dlgCreate, setDlgCreate] = useState(false);
    const [dlgAdmin, setDlgAdmin] = useState(false);
    const [dlgDel, setDlgDel] = useState(false);
    const [dlgMod, setDlgMod] = useState(false);
    const [sel, setSel] = useState<TenantStats | null>(null);

    const filtered = useMemo(() => {
        if (!tenants) return [];
        return tenants.filter(t => {
            const s = t.name.toLowerCase().includes(search.toLowerCase()) ||
                t.slug.toLowerCase().includes(search.toLowerCase());
            const f = statusFilter === 'all' || t.status === statusFilter;
            return s && f;
        });
    }, [tenants, search, statusFilter]);

    const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

    const toggleStatus = async (t: TenantStats) => {
        try {
            const next = t.status === 'active' ? 'suspended' : 'active';
            await updateTenant({ id: t.id, data: { status: next } }).unwrap();
            refetch();
            flash(`University status changed!`);
        } catch { /* silent */ }
    };

    if (sL || tL) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={40} sx={{ color: C.indigo }} />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 4 }}>
            {/* ── Header ─────────────────────────────────────────── */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Typography variant="h3" fontWeight={900} sx={{ color: C.textMain, letterSpacing: '-1px', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                        Dashboard Overview
                    </Typography>
                    <Typography variant="h6" sx={{ color: C.textMuted, mt: 0.5, fontWeight: 700 }}>
                        All systems active and functional.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setDlgCreate(true)}
                    disableElevation
                    sx={{
                        borderRadius: '16px',
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: '1rem',
                        px: 4, py: 1.5,
                        color: 'white',
                        background: 'linear-gradient(145deg, #4f46e5, #4338ca)',
                        boxShadow: '6px 6px 12px #c1c8d1, -6px -6px 12px #ffffff',
                        border: '1px solid #4f46e5',
                        '&:hover': {
                            boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.2)',
                            background: '#4338ca'
                        },
                    }}
                >
                    Add University
                </Button>
            </Box>

            {msg && (
                <Alert severity="success" sx={{
                    mb: 5, borderRadius: '16px', fontWeight: 800,
                    boxShadow: insetShadow, border: '1px solid #ffffff',
                    bgcolor: neuBase, color: C.emerald, '& .MuiAlert-icon': { color: C.emerald }
                }}>
                    {msg}
                </Alert>
            )}

            {/* ── Stats Grid ──────────────────────────────────────────── */}
            <Grid container spacing={3} sx={{ mb: 6 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<BusinessIcon fontSize="large" />}
                        value={gs?.total_tenants || 0}
                        label="Universities"
                        color={C.indigo}
                        subtitle={`${gs?.active_tenants || 0} currently active`}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<PeopleIcon fontSize="large" />}
                        value={gs?.total_users_platform || 0}
                        label="Platform Users"
                        color={C.sky}
                        subtitle="Across all tenants"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<SchoolIcon fontSize="large" />}
                        value={gs?.total_students_platform || 0}
                        label="Students"
                        color={C.emerald}
                        subtitle="Total enrollments"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<StaffIcon fontSize="large" />}
                        value={gs?.total_staff_platform || 0}
                        label="Staff Members"
                        color={C.amber}
                        subtitle="Educators & Admins"
                    />
                </Grid>
            </Grid>

            {/* ── Table Area ─────────────────────────────────────── */}
            <Box sx={{
                bgcolor: neuBase,
                borderRadius: '24px',
                boxShadow: statShadow,
                border: '1px solid #ffffff',
                overflow: 'hidden',
                p: { xs: 1.5, md: 3 }, // generous padding on the table container
                mx: 0.5, mb: 0.5
            }}>
                {/* Filter Bar */}
                <Box sx={{
                    pb: 3, mb: 2,
                    display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap',
                }}>
                    <Typography variant="h5" fontWeight={900} sx={{ color: C.textMain }}>
                        Directory
                    </Typography>

                    <TextField
                        placeholder="Search universities..."
                        size="medium"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: C.indigo }} /></InputAdornment>,
                        }}
                        sx={{
                            width: { xs: '100%', md: 320 },
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '16px',
                                bgcolor: neuBase,
                                boxShadow: insetShadow,
                                '& fieldset': { border: 'none' },
                                '& input': { color: C.textMain, fontWeight: 700 }
                            }
                        }}
                    />
                    <TextField
                        select size="medium"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        sx={{
                            width: { xs: '100%', md: 180 },
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '16px',
                                bgcolor: neuBase,
                                boxShadow: insetShadow,
                                '& fieldset': { border: 'none' },
                                '& .MuiSelect-select': { color: C.textMain, fontWeight: 700 }
                            }
                        }}
                    >
                        <MenuItem value="all" sx={{ fontWeight: 700 }}>All Statuses</MenuItem>
                        <MenuItem value="active" sx={{ fontWeight: 700 }}>Active Only</MenuItem>
                        <MenuItem value="suspended" sx={{ fontWeight: 700 }}>Suspended</MenuItem>
                    </TextField>

                    <Box sx={{ flexGrow: 1 }} />
                    <Chip
                        label={`${filtered.length} Results`}
                        sx={{
                            bgcolor: neuBase, color: C.textMain,
                            boxShadow: statShadow, border: '1px solid #ffffff',
                            fontWeight: 900, borderRadius: '12px', px: 2, height: 44, fontSize: '1rem'
                        }}
                    />
                </Box>

                {/* Data Table */}
                <Box>
                    <TenantTable
                        tenants={filtered}
                        onManageAdmin={t => { setSel(t); setDlgAdmin(true); }}
                        onManageModules={t => { setSel(t); setDlgMod(true); }}
                        onDelete={t => { setSel(t); setDlgDel(true); }}
                        onToggleStatus={toggleStatus}
                    />
                </Box>
            </Box>

            {/* ── Dialogs ────────────────────────────────────────── */}
            <CreateTenantDialog open={dlgCreate} onClose={() => setDlgCreate(false)} onSuccess={() => { refetch(); flash('University created successfully!'); }} />
            <ManageAdminDialog open={dlgAdmin} onClose={() => setDlgAdmin(false)} tenantId={sel?.id || null} onSuccess={() => flash('Admin credentials updated!')} />
            <DeleteConfirmDialog open={dlgDel} onClose={() => setDlgDel(false)} tenant={sel ? { id: sel.id, name: sel.name } : null} onSuccess={() => { refetch(); flash('University deleted.'); }} />
            <ModuleAccessDialog open={dlgMod} onClose={() => setDlgMod(false)} tenant={sel ? { id: sel.id, restricted_modules: sel.restricted_modules } : null} onSuccess={() => { refetch(); flash('Module access updated!'); }} />
        </Box>
    );
};

export default SuperAdminDashboard;
