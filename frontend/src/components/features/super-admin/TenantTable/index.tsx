import React from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
    Typography, IconButton, Tooltip, Stack, Box, Chip
} from '@mui/material';
import {
    OpenInNewRounded as OpenInNewIcon,
    VpnKeyRounded as KeyIcon,
    SettingsRounded as SettingsIcon,
    DeleteRounded as DeleteIcon,
    CheckCircleRounded as CheckIcon,
    CancelRounded as BlockIcon,
} from '@mui/icons-material';
import { TenantStats } from '@/store/api/superAdminApi';
import { useNavigate } from 'react-router-dom';

const neuBase = '#f8fafc';
const statShadow = '4px 4px 8px #c1c8d1, -4px -4px 8px #ffffff';
const insetShadow = 'inset 3px 3px 6px #c1c8d1, inset -3px -3px 6px #ffffff';

const C = {
    indigo: '#4f46e5',
    sky: '#0284c7',
    emerald: '#059669',
    amber: '#d97706',
    rose: '#e11d48',
    textMain: '#0f172a',
    textMuted: '#475569',
};

const ALL_MODULES = ['students', 'courses', 'attendance', 'staff', 'fees', 'calendar', 'reports', 'communication'];

interface TenantTableProps {
    tenants: TenantStats[];
    onManageAdmin: (tenant: TenantStats) => void;
    onManageModules: (tenant: TenantStats) => void;
    onDelete: (tenant: TenantStats) => void;
    onToggleStatus: (tenant: TenantStats) => void;
}

const TenantTable: React.FC<TenantTableProps> = ({
    tenants, onManageAdmin, onManageModules, onDelete, onToggleStatus,
}) => {
    const navigate = useNavigate();

    const getActive = (r: string[] = []) => ALL_MODULES.filter(m => !r.includes(m));
    const fmt = (m: string[]) => m.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

    if (tenants.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="h6" sx={{ color: C.textMain, fontWeight: 800 }}>
                    No universities match your criteria.
                </Typography>
            </Box>
        );
    }

    // Action Button
    const ActionBtn = ({ icon, color, onClick, label }: any) => (
        <Tooltip title={label} arrow>
            <IconButton
                size="small"
                onClick={onClick}
                sx={{
                    color: color,
                    bgcolor: neuBase,
                    boxShadow: statShadow,
                    border: '1px solid #ffffff',
                    borderRadius: '12px',
                    m: 0.5,
                    width: 36, height: 36,
                    '&:hover': { boxShadow: insetShadow }
                }}
            >
                {icon}
            </IconButton>
        </Tooltip>
    );

    return (
        <TableContainer sx={{ borderRadius: '16px', boxShadow: insetShadow, p: 2, bgcolor: neuBase, minHeight: 400 }}>
            <Table sx={{ minWidth: 900 }}>
                <TableHead>
                    <TableRow sx={{
                        '& .MuiTableCell-head': {
                            fontWeight: 900,
                            fontSize: '0.85rem',
                            color: C.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            py: 2.5, px: 3,
                            borderBottom: 'none',
                        },
                    }}>
                        <TableCell>University Details</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Users</TableCell>
                        <TableCell align="center">Students</TableCell>
                        <TableCell align="center">Staff</TableCell>
                        <TableCell>Modules</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {tenants.map(t => {
                        const active = getActive(t.restricted_modules);
                        const restricted = t.restricted_modules || [];
                        const on = t.status === 'active';

                        return (
                            <TableRow key={t.id} sx={{
                                '& .MuiTableCell-root': { py: 2.5, px: 3, borderBottom: '1px solid #e2e8f0', bgcolor: neuBase },
                                '&:last-child .MuiTableCell-root': { borderBottom: 'none' }
                            }}>
                                {/* Name & Slug */}
                                <TableCell>
                                    <Box
                                        onClick={() => navigate(`/tenants/${t.id}`)}
                                        sx={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                                    >
                                        <Typography fontWeight={900} fontSize="1.15rem" sx={{ color: C.textMain, textShadow: '1px 1px 2px rgba(0,0,0,0.02)' }}>
                                            {t.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: C.textMuted, fontWeight: 800, mt: 0.5 }}>
                                            @{t.slug}
                                        </Typography>
                                    </Box>
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                    <Chip
                                        label={t.status}
                                        onClick={() => onToggleStatus(t)}
                                        sx={{
                                            fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase',
                                            bgcolor: neuBase,
                                            boxShadow: on ? insetShadow : statShadow,
                                            color: on ? C.emerald : C.rose,
                                            border: '1px solid #ffffff',
                                            cursor: 'pointer', borderRadius: '12px', height: 36, px: 1
                                        }}
                                    />
                                </TableCell>

                                {/* Counts */}
                                <TableCell align="center">
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: neuBase, boxShadow: insetShadow, color: C.textMain, fontWeight: 900, px: 2, py: 1, borderRadius: '12px' }}>
                                        {t.total_users}
                                    </Box>
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: neuBase, boxShadow: insetShadow, color: C.textMain, fontWeight: 900, px: 2, py: 1, borderRadius: '12px' }}>
                                        {t.total_students || 0}
                                    </Box>
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: neuBase, boxShadow: insetShadow, color: C.textMain, fontWeight: 900, px: 2, py: 1, borderRadius: '12px' }}>
                                        {t.total_staff || 0}
                                    </Box>
                                </TableCell>

                                {/* Modules */}
                                <TableCell>
                                    <Stack direction="row" spacing={1.5}>
                                        <Tooltip title={active.length ? `Active: ${fmt(active)}` : 'None'} arrow>
                                            <Chip icon={<CheckIcon />}
                                                label={`${active.length} Active`} sx={{
                                                    fontWeight: 900, bgcolor: neuBase, color: C.emerald, boxShadow: statShadow, height: 36,
                                                    '& .MuiChip-icon': { color: C.emerald }, border: '1px solid #ffffff', borderRadius: '12px'
                                                }}
                                            />
                                        </Tooltip>
                                        {restricted.length > 0 && (
                                            <Tooltip title={`Restricted: ${fmt(restricted)}`} arrow>
                                                <Chip icon={<BlockIcon />}
                                                    label={restricted.length} sx={{
                                                        fontWeight: 900, bgcolor: neuBase, color: C.rose, boxShadow: statShadow, height: 36,
                                                        '& .MuiChip-icon': { color: C.rose }, border: '1px solid #ffffff', borderRadius: '12px'
                                                    }}
                                                />
                                            </Tooltip>
                                        )}
                                    </Stack>
                                </TableCell>

                                {/* Actions */}
                                <TableCell align="right" sx={{ width: 220 }}>
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <ActionBtn icon={<KeyIcon />} color={C.indigo} onClick={() => onManageAdmin(t)} label="Manage Auth" />
                                        <ActionBtn icon={<SettingsIcon />} color={C.amber} onClick={() => onManageModules(t)} label="Modules" />
                                        <ActionBtn icon={<DeleteIcon />} color={C.rose} onClick={() => onDelete(t)} label="Erase" />
                                        <ActionBtn icon={<OpenInNewIcon />} color={C.textMuted} onClick={() => navigate(`/tenants/${t.id}`)} label="Go To Panel" />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default TenantTable;
