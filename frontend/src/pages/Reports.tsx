import React, { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Chip, IconButton,
    TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, FormControl, InputLabel, Select, MenuItem,
    Pagination, Paper, Tabs, Tab, Avatar, Stack, Skeleton, Tooltip,
    useTheme, Accordion, AccordionSummary, AccordionDetails, Checkbox,
    FormControlLabel, FormGroup, Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Assessment as ReportIcon,
    Download as DownloadIcon,
    CheckCircle as CompleteIcon,
    Error as ErrorIcon,
    HourglassEmpty as PendingIcon,
    Refresh as RefreshIcon,
    School as SchoolIcon,
    People as PeopleIcon,
    Payment as PaymentIcon,
    TrendingUp as TrendingIcon,
    PieChart as ChartIcon,
    Email as EmailIcon,
    Warning as WarningIcon,
    Category as CategoryIcon,
    Today as TodayIcon,
    PersonAdd as PersonAddIcon,
    AccessTime as AccessTimeIcon,
    Cancel as CancelIcon,
    CheckCircleOutline as CheckIcon,
    Settings as SettingsIcon,
    Build as BuildIcon,
    ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
    useGetReportsQuery,
    useGetReportTypesQuery,
    useGenerateReportMutation,
    useDeleteReportMutation,
    useGetQuickStatsQuery,
    useGetAvailableFieldsQuery,
    Report,
    ReportType
} from '@/store/api/reportApi';
import { toast } from 'react-toastify';

const iconMap: Record<string, React.ReactNode> = {
    school: <SchoolIcon />,
    people: <PeopleIcon />,
    payments: <PaymentIcon />,
    pie_chart: <ChartIcon />,
    person_add: <PersonAddIcon />,
    access_time: <AccessTimeIcon />,
    warning: <WarningIcon />,
    category: <CategoryIcon />,
    today: <TodayIcon />,
    check_circle: <CheckIcon />,
    cancel: <CancelIcon />,
    email: <EmailIcon />,
    settings: <SettingsIcon />,
    build: <BuildIcon />,
};

const categoryColors: Record<string, string> = {
    Students: '#4f46e5',
    Staff: '#0891b2',
    Finance: '#059669',
    Attendance: '#d97706',
    Communication: '#dc2626',
    Custom: '#8b5cf6',
    Other: '#64748b',
};

interface TabPanelProps {
    children?: React.ReactNode;
    value: number;
    index: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
    <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>
);

const ReportsPage: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [page, setPage] = useState(1);
    const [tabValue, setTabValue] = useState(0);
    const [openGenerate, setOpenGenerate] = useState(false);
    const [openView, setOpenView] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const [generateForm, setGenerateForm] = useState({
        name: '',
        description: '',
        report_type: 'student_list',
        format: 'json',
        start_date: '',
        end_date: '',
    });

    // Custom report field selection
    const [selectedFields, setSelectedFields] = useState<Record<string, string[]>>({
        students: [],
        staff: [],
        fees: [],
        messages: [],
    });

    const { data: quickStats, isLoading: statsLoading } = useGetQuickStatsQuery();
    const { data: reports, isLoading, error, refetch } = useGetReportsQuery({ page, pageSize: 10 });
    const { data: reportTypes } = useGetReportTypesQuery();
    const { data: availableFields } = useGetAvailableFieldsQuery();
    const [generateReport, { isLoading: isGenerating }] = useGenerateReportMutation();
    const [deleteReport, { isLoading: isDeleting }] = useDeleteReportMutation();

    const handleOpenGenerate = (type?: ReportType) => {
        setGenerateForm({
            name: type?.label || '',
            description: type?.description || '',
            report_type: type?.value || 'student_list',
            format: 'json',
            start_date: '',
            end_date: '',
        });
        // Reset field selection for custom reports
        setSelectedFields({ students: [], staff: [], fees: [], messages: [] });
        setOpenGenerate(true);
    };

    const handleFieldToggle = (entity: string, fieldKey: string) => {
        setSelectedFields(prev => {
            const current = prev[entity] || [];
            if (current.includes(fieldKey)) {
                return { ...prev, [entity]: current.filter(f => f !== fieldKey) };
            } else {
                return { ...prev, [entity]: [...current, fieldKey] };
            }
        });
    };

    const handleSelectAllFields = (entity: string) => {
        if (!availableFields) return;
        const entityData = availableFields[entity as keyof typeof availableFields];
        if (!entityData) return;

        const allKeys = entityData.fields.map(f => f.key);
        const current = selectedFields[entity] || [];

        if (current.length === allKeys.length) {
            // Deselect all
            setSelectedFields(prev => ({ ...prev, [entity]: [] }));
        } else {
            // Select all
            setSelectedFields(prev => ({ ...prev, [entity]: allKeys }));
        }
    };

    const getTotalSelectedFields = () => {
        return Object.values(selectedFields).reduce((sum, arr) => sum + arr.length, 0);
    };

    const handleGenerate = async () => {
        try {
            // Validate custom report has at least one field selected
            if (generateForm.report_type === 'custom' && getTotalSelectedFields() === 0) {
                toast.error('Please select at least one field for custom report');
                return;
            }

            const payload: any = {
                ...generateForm,
                name: generateForm.name || `${generateForm.report_type} Report`,
                start_date: generateForm.start_date || undefined,
                end_date: generateForm.end_date || undefined,
            };

            // Add selected fields for custom reports
            if (generateForm.report_type === 'custom') {
                payload.parameters = { selected_fields: selectedFields };
            }

            const result = await generateReport(payload).unwrap();
            toast.success('Report generated successfully!');
            setOpenGenerate(false);
            refetch();
            setSelectedReport(result);
            setOpenView(true);
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Failed to generate report');
        }
    };

    const handleViewReport = (report: Report) => {
        setSelectedReport(report);
        setOpenView(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteReport(id).unwrap();
            toast.success('Report deleted!');
            setDeleteConfirm(null);
            setOpenView(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.data?.detail || 'Delete failed');
        }
    };

    const handleExport = (report: Report) => {
        const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
        const exportUrl = `${baseUrl}/reports/${report.id}/export?format=csv`;
        window.open(exportUrl, '_blank');
        toast.info('Downloading CSV...');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CompleteIcon color="success" />;
            case 'failed': return <ErrorIcon color="error" />;
            case 'processing': return <RefreshIcon color="info" sx={{ animation: 'spin 1s linear infinite' }} />;
            default: return <PendingIcon color="warning" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'processing': return 'info';
            default: return 'warning';
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-IN');
    };

    const formatCurrency = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount.toFixed(0)}`;
    };

    const renderReportData = (data: Record<string, any>) => {
        if (!data || Object.keys(data).length === 0) {
            return <Typography color="text.secondary">No data available</Typography>;
        }

        if (data.summary) {
            return (
                <Box>
                    <Typography variant="h6" gutterBottom>Summary</Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {Object.entries(data.summary).map(([key, value]) => (
                            <Grid item xs={6} sm={4} md={3} key={key}>
                                <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                        {key.replace(/_/g, ' ')}
                                    </Typography>
                                    <Typography variant="h5" fontWeight={600}>
                                        {typeof value === 'number' && key.includes('amount')
                                            ? formatCurrency(value as number)
                                            : String(value)}
                                    </Typography>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {data.records && data.records.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="h6" gutterBottom>Records ({data.records.length})</Typography>
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {Object.keys(data.records[0]).filter(k => k !== '_entity').map(key => (
                                                <TableCell key={key} sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                                    {key.replace(/_/g, ' ')}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.records.slice(0, 50).map((row: any, idx: number) => (
                                            <TableRow key={idx}>
                                                {Object.entries(row).filter(([k]) => k !== '_entity').map(([, val]: any, i: number) => (
                                                    <TableCell key={i}>{String(val ?? '-')}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {data.records.length > 50 && (
                                <Typography sx={{ p: 1, textAlign: 'center' }} variant="caption" color="text.secondary">
                                    Showing 50 of {data.records.length} rows. Export to CSV for full data.
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            );
        }

        if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
            return (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {Object.keys(data.rows[0]).filter(k => k !== '_entity').map(key => (
                                    <TableCell key={key} sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                        {key.replace(/_/g, ' ')}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.rows.slice(0, 50).map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                    {Object.entries(row).filter(([k]) => k !== '_entity').map(([, val]: any, i: number) => (
                                        <TableCell key={i}>{String(val ?? '-')}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            );
        }

        return <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>;
    };

    const groupedTypes = reportTypes?.reduce((acc, type) => {
        const cat = type.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(type);
        return acc;
    }, {} as Record<string, ReportType[]>) || {};

    const filteredTypes = selectedCategory === 'all'
        ? reportTypes
        : reportTypes?.filter(t => t.category === selectedCategory);

    const statsCards = [
        { label: 'Total Students', value: quickStats?.total_students || 0, icon: <SchoolIcon />, color: '#4f46e5' },
        { label: 'Total Staff', value: quickStats?.total_staff || 0, icon: <PeopleIcon />, color: '#0891b2' },
        { label: 'Fee Collected', value: formatCurrency(quickStats?.total_fee_collected || 0), icon: <PaymentIcon />, color: '#059669' },
        { label: 'Fee Pending', value: formatCurrency(quickStats?.total_fee_pending || 0), icon: <WarningIcon />, color: '#d97706' },
    ];

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" color="text.primary">
                        Reports & Analytics
                    </Typography>
                    <Typography color="text.secondary">
                        Generate reports, view analytics, and export data
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenGenerate()}
                    sx={{ borderRadius: 2 }}
                >
                    Generate Report
                </Button>
            </Box>

            {/* Quick Stats */}
            <Card sx={{ mb: 4 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingIcon color="primary" /> Quick Stats
                    </Typography>
                    <Grid container spacing={2}>
                        {statsCards.map((stat) => (
                            <Grid item xs={6} sm={3} key={stat.label}>
                                {statsLoading ? (
                                    <Skeleton variant="rounded" height={80} />
                                ) : (
                                    <Box sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        backgroundColor: isDark ? `${stat.color}15` : `${stat.color}08`,
                                        border: '1px solid',
                                        borderColor: isDark ? `${stat.color}30` : `${stat.color}20`,
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                                        </Box>
                                        <Typography variant="h5" fontWeight="bold">{stat.value}</Typography>
                                        <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                                    </Box>
                                )}
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
                <Tab label="Report Templates" />
                <Tab label="Generated Reports" />
            </Tabs>

            {/* Tab 0: Report Templates */}
            <TabPanel value={tabValue} index={0}>
                <Stack direction="row" gap={1} mb={3} flexWrap="wrap">
                    <Chip
                        label="All"
                        onClick={() => setSelectedCategory('all')}
                        color={selectedCategory === 'all' ? 'primary' : 'default'}
                        variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
                    />
                    {Object.keys(groupedTypes).map(cat => (
                        <Chip
                            key={cat}
                            label={cat}
                            onClick={() => setSelectedCategory(cat)}
                            color={selectedCategory === cat ? 'primary' : 'default'}
                            variant={selectedCategory === cat ? 'filled' : 'outlined'}
                        />
                    ))}
                </Stack>

                <Grid container spacing={2}>
                    {filteredTypes?.map((type) => (
                        <Grid item xs={6} sm={4} md={3} key={type.value}>
                            <Card
                                sx={{
                                    height: '100%',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: type.value === 'custom' ? '2px solid' : '1px solid',
                                    borderColor: type.value === 'custom' ? 'secondary.main' : 'divider',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4,
                                    },
                                }}
                                onClick={() => handleOpenGenerate(type)}
                            >
                                <CardContent sx={{ p: 2.5 }}>
                                    <Avatar sx={{
                                        width: 48,
                                        height: 48,
                                        mb: 2,
                                        bgcolor: `${categoryColors[type.category] || '#4f46e5'}15`,
                                        color: categoryColors[type.category] || '#4f46e5',
                                    }}>
                                        {iconMap[type.icon] || <ReportIcon />}
                                    </Avatar>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                        {type.label}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                        {type.description}
                                    </Typography>
                                    <Chip
                                        label={type.category}
                                        size="small"
                                        sx={{ mt: 1.5, backgroundColor: `${categoryColors[type.category] || '#64748b'}20` }}
                                    />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </TabPanel>

            {/* Tab 1: Generated Reports */}
            <TabPanel value={tabValue} index={1}>
                {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load reports.</Alert>}

                {!isLoading && reports && reports.items.length > 0 && (
                    <Card>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Report</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Rows</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Generated</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {reports.items.map((report) => (
                                        <TableRow
                                            key={report.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleViewReport(report)}
                                        >
                                            <TableCell>
                                                <Typography fontWeight={600}>{report.name}</Typography>
                                            </TableCell>
                                            <TableCell sx={{ textTransform: 'capitalize' }}>
                                                {report.report_type.replace(/_/g, ' ')}
                                            </TableCell>
                                            <TableCell>{report.row_count}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getStatusIcon(report.status)}
                                                    label={report.status}
                                                    size="small"
                                                    color={getStatusColor(report.status) as any}
                                                />
                                            </TableCell>
                                            <TableCell>{formatDate(report.generated_at)}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Export CSV">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => { e.stopPropagation(); handleExport(report); }}
                                                        disabled={report.status !== 'completed'}
                                                    >
                                                        <DownloadIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(report.id); }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                )}

                {!isLoading && reports?.items.length === 0 && (
                    <Card sx={{ p: 6, textAlign: 'center' }}>
                        <ReportIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No reports generated yet
                        </Typography>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTabValue(0)}>
                            View Templates
                        </Button>
                    </Card>
                )}

                {reports && reports.total_pages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <Pagination count={reports.total_pages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                    </Box>
                )}
            </TabPanel>

            {/* Generate Report Dialog */}
            <Dialog open={openGenerate} onClose={() => setOpenGenerate(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {generateForm.report_type === 'custom' ? 'Custom Report Builder' : 'Generate Report'}
                    <IconButton onClick={() => setOpenGenerate(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Report Type *</InputLabel>
                            <Select
                                value={generateForm.report_type}
                                label="Report Type *"
                                onChange={(e) => {
                                    const type = reportTypes?.find(t => t.value === e.target.value);
                                    setGenerateForm({
                                        ...generateForm,
                                        report_type: e.target.value,
                                        name: type?.label || '',
                                        description: type?.description || '',
                                    });
                                }}
                            >
                                {reportTypes?.map(t => (
                                    <MenuItem key={t.value} value={t.value}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {iconMap[t.icon] || <ReportIcon fontSize="small" />}
                                            {t.label}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            label="Report Name"
                            value={generateForm.name}
                            onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
                            placeholder="Leave empty for auto-generated name"
                        />

                        {/* Custom Report Field Selector */}
                        {generateForm.report_type === 'custom' && availableFields && (
                            <Box>
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    Select the fields you want to include in your custom report. You can select fields from multiple entities.
                                </Alert>

                                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    Selected: <Chip label={`${getTotalSelectedFields()} fields`} size="small" color="primary" />
                                </Typography>

                                {Object.entries(availableFields).map(([entity, entityData]) => (
                                    <Accordion key={entity} defaultExpanded={entity === 'students'}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                <Typography fontWeight={600}>{entityData.label}</Typography>
                                                <Chip
                                                    label={`${(selectedFields[entity] || []).length}/${entityData.fields.length}`}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                                <Box sx={{ flex: 1 }} />
                                                <Button
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); handleSelectAllFields(entity); }}
                                                >
                                                    {(selectedFields[entity] || []).length === entityData.fields.length ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <FormGroup row>
                                                {entityData.fields.map((field) => (
                                                    <FormControlLabel
                                                        key={field.key}
                                                        control={
                                                            <Checkbox
                                                                checked={(selectedFields[entity] || []).includes(field.key)}
                                                                onChange={() => handleFieldToggle(entity, field.key)}
                                                                size="small"
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography variant="body2">{field.label}</Typography>
                                                                <Typography variant="caption" color="text.secondary">{field.type}</Typography>
                                                            </Box>
                                                        }
                                                        sx={{
                                                            width: '180px',
                                                            mr: 2,
                                                            mb: 1,
                                                            border: '1px solid',
                                                            borderColor: 'divider',
                                                            borderRadius: 1,
                                                            px: 1,
                                                            py: 0.5,
                                                            m: 0.5,
                                                        }}
                                                    />
                                                ))}
                                            </FormGroup>
                                        </AccordionDetails>
                                    </Accordion>
                                ))}
                            </Box>
                        )}

                        {generateForm.report_type !== 'custom' && (
                            <>
                                <TextField
                                    fullWidth
                                    label="Description"
                                    multiline
                                    rows={2}
                                    value={generateForm.description}
                                    onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
                                />
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            type="date"
                                            label="Start Date"
                                            value={generateForm.start_date}
                                            onChange={(e) => setGenerateForm({ ...generateForm, start_date: e.target.value })}
                                            InputLabelProps={{ shrink: true }}
                                            helperText="Optional - for date-filtered reports"
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            type="date"
                                            label="End Date"
                                            value={generateForm.end_date}
                                            onChange={(e) => setGenerateForm({ ...generateForm, end_date: e.target.value })}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                </Grid>
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenGenerate(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        startIcon={generateForm.report_type === 'custom' ? <BuildIcon /> : <ReportIcon />}
                        onClick={handleGenerate}
                        disabled={isGenerating || (generateForm.report_type === 'custom' && getTotalSelectedFields() === 0)}
                    >
                        {isGenerating ? <CircularProgress size={24} /> : 'Generate'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* View Report Dialog */}
            <Dialog open={openView} onClose={() => setOpenView(false)} maxWidth="lg" fullWidth>
                {selectedReport && (
                    <>
                        <DialogTitle>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {getStatusIcon(selectedReport.status)}
                                <Box>
                                    <Typography variant="h6">{selectedReport.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {selectedReport.row_count} rows • Generated {formatDate(selectedReport.generated_at)}
                                    </Typography>
                                </Box>
                            </Box>
                            <IconButton onClick={() => setOpenView(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent dividers sx={{ maxHeight: '65vh' }}>
                            {selectedReport.status === 'failed' ? (
                                <Alert severity="error">{selectedReport.error_message || 'Report generation failed'}</Alert>
                            ) : (
                                renderReportData(selectedReport.data)
                            )}
                        </DialogContent>
                        <DialogActions sx={{ p: 2 }}>
                            <Button color="error" onClick={() => setDeleteConfirm(selectedReport.id)} startIcon={<DeleteIcon />}>
                                Delete
                            </Button>
                            <Box sx={{ flex: 1 }} />
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleExport(selectedReport)}
                                disabled={selectedReport.status !== 'completed'}
                            >
                                Export CSV
                            </Button>
                            <Button onClick={() => setOpenView(false)}>Close</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Delete Report?</DialogTitle>
                <DialogContent><Typography>This action cannot be undone.</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={isDeleting}>
                        {isDeleting ? <CircularProgress size={24} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ReportsPage;
