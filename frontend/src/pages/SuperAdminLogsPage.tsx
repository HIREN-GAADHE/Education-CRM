import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

// Mock log data - In production, this would come from an API
const mockLogs = [
    { id: 1, timestamp: '2024-12-28 17:30:00', level: 'INFO', action: 'User Login', user: 'admin@test.com', details: 'Successful login' },
    { id: 2, timestamp: '2024-12-28 17:28:00', level: 'WARNING', action: 'Failed Login', user: 'unknown', details: 'Invalid credentials' },
    { id: 3, timestamp: '2024-12-28 17:25:00', level: 'INFO', action: 'Tenant Created', user: 'superadmin@eduerp.com', details: 'New university: IIT Delhi' },
    { id: 4, timestamp: '2024-12-28 17:20:00', level: 'ERROR', action: 'API Error', user: 'system', details: 'Database connection timeout' },
    { id: 5, timestamp: '2024-12-28 17:15:00', level: 'INFO', action: 'Settings Updated', user: 'superadmin@eduerp.com', details: 'Changed platform name' },
];

const SuperAdminLogsPage: React.FC = () => {
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const filteredLogs = mockLogs.filter(log => {
        const matchesFilter = filter === 'all' || log.level.toLowerCase() === filter;
        const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) ||
            log.user.toLowerCase().includes(search.toLowerCase()) ||
            log.details.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'INFO': return 'info';
            case 'WARNING': return 'warning';
            case 'ERROR': return 'error';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 4 }}>System Logs</Typography>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                    placeholder="Search logs..."
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
                    }}
                    sx={{ width: 300 }}
                />
                <FormControl size="small" sx={{ width: 150 }}>
                    <InputLabel>Level</InputLabel>
                    <Select
                        value={filter}
                        label="Level"
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <MenuItem value="all">All Levels</MenuItem>
                        <MenuItem value="info">Info</MenuItem>
                        <MenuItem value="warning">Warning</MenuItem>
                        <MenuItem value="error">Error</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {/* Logs Table */}
            <Paper>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Timestamp</TableCell>
                            <TableCell>Level</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>User</TableCell>
                            <TableCell>Details</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredLogs.map((log) => (
                            <TableRow key={log.id} hover>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {log.timestamp}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={log.level}
                                        color={getLevelColor(log.level) as any}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>{log.action}</TableCell>
                                <TableCell>{log.user}</TableCell>
                                <TableCell>{log.details}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Showing {filteredLogs.length} of {mockLogs.length} logs
            </Typography>
        </Box>
    );
};

export default SuperAdminLogsPage;
