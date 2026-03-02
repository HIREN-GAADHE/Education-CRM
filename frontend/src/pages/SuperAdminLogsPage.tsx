import React, { useState } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
    TextField, MenuItem, Select, FormControl,
    CircularProgress, Alert, TableContainer, Pagination, Chip
} from '@mui/material';
import { HistoryEduRounded, SearchRounded } from '@mui/icons-material';
import { useGetAuditLogsQuery } from '@/store/api/superAdminApi';

const neuBase = '#f8fafc';
const neuDark = '#c1c8d1';
const neuLight = '#ffffff';

const statShadow = `6px 6px 12px ${neuDark}, -6px -6px 12px ${neuLight}`;
const insetShadow = `inset 4px 4px 8px ${neuDark}, inset -4px -4px 8px ${neuLight}`;

const C = {
    indigo: '#4f46e5',
    sky: '#0ea5e9',
    amber: '#d97706',
    rose: '#e11d48',
    violet: '#7c3aed',
    textMain: '#0f172a',
    textMuted: '#475569',
};

const SuperAdminLogsPage: React.FC = () => {
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data: logs, isLoading, isError } = useGetAuditLogsQuery({ page, pageSize: 50 });

    const filtered = (logs || []).filter(l => {
        const f = filter === 'all' || l.level.toLowerCase() === filter;
        const s = l.action.toLowerCase().includes(search.toLowerCase()) ||
            l.user_email.toLowerCase().includes(search.toLowerCase()) ||
            l.details.toLowerCase().includes(search.toLowerCase()) ||
            (l.tenant_name || '').toLowerCase().includes(search.toLowerCase());
        return f && s;
    });

    const LevelChip = ({ level }: { level: string }) => {
        const L = level.toUpperCase();
        let color = C.textMuted;
        if (L === 'INFO') color = C.sky;
        if (L === 'WARNING') color = C.amber;
        if (L === 'ERROR') color = C.rose;

        return (
            <Chip
                label={L}
                sx={{
                    fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1,
                    bgcolor: neuBase,
                    boxShadow: statShadow,
                    color: color,
                    border: '1px solid #ffffff', borderRadius: '12px'
                }}
            />
        );
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 4 }}>
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{
                    width: 70, height: 70, borderRadius: '20px',
                    background: 'linear-gradient(145deg, #7c3aed, #6d28d9)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '6px 6px 12px #c1c8d1, -6px -6px 12px #ffffff',
                    border: '2px solid #7c3aed'
                }}>
                    <HistoryEduRounded fontSize="large" sx={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))' }} />
                </Box>
                <Box>
                    <Typography variant="h3" fontWeight={900} sx={{ color: C.textMain, letterSpacing: '-1px', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                        System Logbook
                    </Typography>
                    <Typography variant="h6" sx={{ color: C.textMuted, fontWeight: 700, mt: 0.5 }}>
                        High-contrast traceable action history.
                    </Typography>
                </Box>
            </Box>

            <Box sx={{
                bgcolor: neuBase, borderRadius: '24px',
                mx: 0.5, mb: 0.5,
                boxShadow: statShadow, border: '1px solid #ffffff',
                overflow: 'hidden', p: { xs: 1.5, md: 3 }
            }}>
                <Box sx={{
                    pb: 3, mb: 2,
                    display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: C.violet }}>
                        <SearchRounded fontSize="large" />
                        <Typography variant="h5" fontWeight={900} sx={{ color: C.textMain }}>Filter Log Matrix</Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />

                    <TextField
                        placeholder="Search traces..."
                        size="medium" value={search}
                        onChange={e => setSearch(e.target.value)}
                        sx={{
                            width: { xs: '100%', md: 380 },
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '16px', bgcolor: neuBase,
                                boxShadow: insetShadow,
                                '& fieldset': { border: 'none' },
                                '& input': { color: C.textMain, fontWeight: 800, fontSize: '1.05rem', p: 2 }
                            }
                        }}
                    />
                    <FormControl size="medium" sx={{ width: { xs: '100%', md: 220 } }}>
                        <Select value={filter} onChange={e => setFilter(e.target.value)}
                            sx={{
                                borderRadius: '16px', bgcolor: neuBase,
                                boxShadow: insetShadow,
                                '& fieldset': { border: 'none' },
                                '& .MuiSelect-select': { color: C.textMain, fontWeight: 800, fontSize: '1.05rem', py: 2 }
                            }}
                        >
                            <MenuItem value="all" sx={{ fontWeight: 800 }}>Every Level</MenuItem>
                            <MenuItem value="info" sx={{ fontWeight: 800 }}>Information</MenuItem>
                            <MenuItem value="warning" sx={{ fontWeight: 800 }}>Warnings</MenuItem>
                            <MenuItem value="error" sx={{ fontWeight: 800 }}>Critical Errors</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={40} sx={{ color: C.violet }} /></Box>}
                {isError && <Alert severity="error" sx={{ m: 3, borderRadius: '16px', boxShadow: insetShadow, border: '1px solid #ffffff', bgcolor: neuBase, color: C.rose, '& .MuiAlert-icon': { color: C.rose } }}>Extraction architecture failed to return logs.</Alert>}

                {!isLoading && !isError && (
                    <TableContainer sx={{ borderRadius: '16px', boxShadow: insetShadow, p: 2, bgcolor: neuBase, mb: 2 }}>
                        <Table sx={{ minWidth: 900 }}>
                            <TableHead>
                                <TableRow sx={{
                                    '& .MuiTableCell-head': {
                                        fontWeight: 900, fontSize: '0.85rem', color: C.textMuted, py: 2.5, px: 3,
                                        textTransform: 'uppercase', letterSpacing: 1, borderBottom: 'none',
                                    }
                                }}>
                                    <TableCell>Timestamp</TableCell>
                                    <TableCell>Severity</TableCell>
                                    <TableCell>Executed Action</TableCell>
                                    <TableCell>Operator</TableCell>
                                    <TableCell>Target DB</TableCell>
                                    <TableCell>Raw Trace Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Typography variant="h6" sx={{ color: C.textMain, fontWeight: 800 }} py={8}>
                                                No logs matching those bounds.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(l => (
                                    <TableRow key={l.id} sx={{ '& .MuiTableCell-root': { py: 2.5, px: 3, borderBottom: '1px solid #e2e8f0', bgcolor: neuBase }, '&:last-child .MuiTableCell-root': { borderBottom: 'none' } }}>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.9rem', color: C.textMuted, whiteSpace: 'nowrap', fontWeight: 800 }}>
                                            {new Date(l.timestamp).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                                            })}
                                        </TableCell>
                                        <TableCell><LevelChip level={l.level} /></TableCell>
                                        <TableCell><Typography fontWeight={900} fontSize="1.05rem" sx={{ color: C.violet }}>{l.action}</Typography></TableCell>
                                        <TableCell sx={{ color: C.textMain, fontSize: '1.05rem', fontWeight: 900 }}>{l.user_email}</TableCell>
                                        <TableCell sx={{ color: C.textMuted, fontSize: '1.05rem', fontWeight: 800 }}>{l.tenant_name || 'Global Core'}</TableCell>
                                        <TableCell sx={{ maxWidth: 320 }}>
                                            <Typography variant="body2" sx={{ fontSize: '0.95rem', color: C.textMain, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 700 }} title={l.details}>
                                                {l.details}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <Pagination count={5} page={page} onChange={(_, v) => setPage(v)} size="large" sx={{
                        '& .MuiPaginationItem-root': {
                            fontWeight: 900, fontSize: '1rem',
                            bgcolor: neuBase, boxShadow: statShadow, border: '1px solid #ffffff',
                            m: 1, width: 44, height: 44,
                            color: C.textMain,
                            '&.Mui-selected': { bgcolor: C.violet, color: 'white', '&:hover': { bgcolor: '#6d28d9' }, boxShadow: 'none' }
                        }
                    }} />
                </Box>
            </Box>
        </Box>
    );
};

export default SuperAdminLogsPage;
