import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Card, CardContent, CardActions,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, Tab, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, MenuItem, Alert, CircularProgress,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    ListItemIcon, Tooltip, alpha, useTheme, Collapse,
    InputAdornment, Autocomplete,
} from '@mui/material';
import {
    Add as AddIcon,
    DirectionsBus as BusIcon,
    Route as RouteIcon,
    Person as PersonIcon,
    LocationOn as LocationIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    PersonAdd as PersonAddIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    CheckCircle as ActiveIcon,
    Block as InactiveIcon,
    Build as MaintenanceIcon,
    AddLocation as AddStopIcon,
    GpsFixed as GpsIcon,
    Schedule as ScheduleIcon,
    CurrencyRupee as FeeIcon,
    Speed as SpeedIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
    useGetVehiclesQuery,
    useCreateVehicleMutation,
    useDeleteVehicleMutation,
    useUpdateVehicleMutation,
    useUpdateVehicleStatusMutation,
    useGetRoutesQuery,
    useCreateRouteMutation,
    useUpdateRouteMutation,
    useDeleteRouteMutation,
    useUpdateRouteStatusMutation,
    useAddRouteStopMutation,
    useUpdateRouteStopMutation,
    useDeleteRouteStopMutation,
    useGetAssignmentsQuery,
    useAssignStudentMutation,
    useRemoveAssignmentMutation,
    useGetTransportStatsQuery,
    Vehicle, TransportRoute, RouteStop,
} from '../store/api/transportApi';
import { useGetAllStudentsQuery } from '../store/api/studentApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, any> = { active: 'success', inactive: 'error', maintenance: 'warning', suspended: 'warning' };
const STATUS_ICON: Record<string, React.ReactNode> = {
    active: <ActiveIcon fontSize="small" />,
    inactive: <InactiveIcon fontSize="small" />,
    maintenance: <MaintenanceIcon fontSize="small" />,
    suspended: <InactiveIcon fontSize="small" />,
};

const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) => (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, height: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: alpha(color, 0.12), color, mb: 1 }}>{icon}</Box>
            <Typography variant="h4" fontWeight={800}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </CardContent>
    </Card>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TransportPage() {
    const theme = useTheme();
    const [tab, setTab] = useState(0);

    const { data: vehiclesData, isLoading: vehiclesLoading } = useGetVehiclesQuery({ page: 1, pageSize: 50 });
    const { data: routesData, isLoading: routesLoading } = useGetRoutesQuery({ page: 1, pageSize: 50 });
    const { data: assignmentsData, isLoading: assignmentsLoading } = useGetAssignmentsQuery({ page: 1, pageSize: 100 });
    const { data: stats } = useGetTransportStatsQuery();
    const { data: allStudents = [] } = useGetAllStudentsQuery();

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'linear-gradient(135deg, #1a365d, #2b6cb0)' }}>
                    <BusIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Transport Management</Typography>
                    <Typography variant="body2" color="text.secondary">Manage vehicles, routes, stops & student assignments</Typography>
                </Box>
            </Box>

            {/* Stat Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Total Vehicles', value: stats?.total_vehicles ?? 0, icon: <BusIcon />, color: '#4299e1' },
                    { label: 'Active Vehicles', value: stats?.active_vehicles ?? 0, icon: <ActiveIcon />, color: '#48bb78' },
                    { label: 'Total Routes', value: stats?.total_routes ?? 0, icon: <RouteIcon />, color: '#ed8936' },
                    { label: 'Active Routes', value: stats?.active_routes ?? 0, icon: <ActiveIcon />, color: '#48bb78' },
                    { label: 'Route Stops', value: stats?.total_stops ?? 0, icon: <LocationIcon />, color: '#9f7aea' },
                    { label: 'Students Assigned', value: stats?.total_students ?? 0, icon: <PersonIcon />, color: '#f56565' },
                ].map((s) => (
                    <Grid item xs={6} sm={4} md={2} key={s.label}>
                        <StatCard {...s} />
                    </Grid>
                ))}
            </Grid>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Tab icon={<BusIcon />} iconPosition="start" label="Vehicles" />
                    <Tab icon={<RouteIcon />} iconPosition="start" label="Routes & Stops" />
                    <Tab icon={<PersonIcon />} iconPosition="start" label="Assignments" />
                </Tabs>
                <Box sx={{ p: 3 }}>
                    {tab === 0 && <VehiclesTab vehicles={vehiclesData?.items ?? []} loading={vehiclesLoading} />}
                    {tab === 1 && <RoutesTab routes={routesData?.items ?? []} vehicles={vehiclesData?.items ?? []} loading={routesLoading} />}
                    {tab === 2 && <AssignmentsTab assignments={assignmentsData?.items ?? []} routes={routesData?.items ?? []} students={allStudents} loading={assignmentsLoading} />}
                </Box>
            </Paper>
        </Box>
    );
}

// ── Vehicles Tab ───────────────────────────────────────────────────────────────
function VehiclesTab({ vehicles, loading }: { vehicles: Vehicle[]; loading: boolean }) {
    const [open, setOpen] = useState(false);
    const [editItem, setEditItem] = useState<Vehicle | null>(null);
    const defaultForm = { vehicle_number: '', vehicle_type: 'bus', make: '', model: '', seating_capacity: 40, registration_number: '', insurance_number: '', gps_enabled: false, notes: '' };
    const [form, setForm] = useState<any>(defaultForm);

    const [createVehicle, { isLoading: isCreating }] = useCreateVehicleMutation();
    const [updateVehicle, { isLoading: isUpdating }] = useUpdateVehicleMutation();
    const [updateStatus] = useUpdateVehicleStatusMutation();
    const [deleteVehicle] = useDeleteVehicleMutation();

    const openCreate = () => { setForm(defaultForm); setEditItem(null); setOpen(true); };
    const openEdit = (v: Vehicle) => { setForm({ ...v }); setEditItem(v); setOpen(true); };

    const handleSave = async () => {
        if (!form.vehicle_number) { toast.error('Vehicle number required'); return; }
        try {
            if (editItem) {
                await updateVehicle({ id: editItem.id, data: form }).unwrap();
                toast.success('Vehicle updated');
            } else {
                await createVehicle(form).unwrap();
                toast.success('Vehicle added');
            }
            setOpen(false);
        } catch (e: any) { toast.error(e.data?.detail || 'Failed'); }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await updateStatus({ id, status }).unwrap();
            toast.success(`Status changed to ${status}`);
        } catch { toast.error('Failed to update status'); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this vehicle?')) return;
        try { await deleteVehicle(id).unwrap(); toast.success('Vehicle deleted'); }
        catch (e: any) { toast.error(e.data?.detail || 'Failed'); }
    };

    if (loading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    Add Vehicle
                </Button>
            </Box>

            {vehicles.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No vehicles yet. Add your first vehicle.</Alert>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell><strong>Vehicle No.</strong></TableCell>
                                <TableCell><strong>Type</strong></TableCell>
                                <TableCell><strong>Make / Model</strong></TableCell>
                                <TableCell align="center"><strong>Capacity</strong></TableCell>
                                <TableCell><strong>GPS</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {vehicles.map((v) => (
                                <TableRow key={v.id} hover>
                                    <TableCell><Typography fontWeight={700}>{v.vehicle_number}</Typography></TableCell>
                                    <TableCell>
                                        <Chip icon={<BusIcon />} label={v.vehicle_type.replace('_', ' ').toUpperCase()} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</TableCell>
                                    <TableCell align="center">{v.seating_capacity} seats</TableCell>
                                    <TableCell>
                                        <Chip icon={<GpsIcon />} label={v.gps_enabled ? 'On' : 'Off'} size="small"
                                            color={v.gps_enabled ? 'success' : 'default'} variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            select
                                            value={v.status}
                                            size="small"
                                            variant="outlined"
                                            onChange={(e) => handleStatusChange(v.id, e.target.value)}
                                            sx={{ minWidth: 130, '& .MuiSelect-select': { py: 0.5 } }}
                                            SelectProps={{
                                                renderValue: (val: any) => (
                                                    <Chip icon={STATUS_ICON[val] as any} label={val.charAt(0).toUpperCase() + val.slice(1)}
                                                        size="small" color={STATUS_COLOR[val]} sx={{ cursor: 'pointer' }} />
                                                ),
                                            }}
                                        >
                                            <MenuItem value="active"><ActiveIcon sx={{ mr: 1, color: 'success.main', fontSize: 18 }} />Active</MenuItem>
                                            <MenuItem value="maintenance"><MaintenanceIcon sx={{ mr: 1, color: 'warning.main', fontSize: 18 }} />Maintenance</MenuItem>
                                            <MenuItem value="inactive"><InactiveIcon sx={{ mr: 1, color: 'error.main', fontSize: 18 }} />Inactive</MenuItem>
                                        </TextField>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(v)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(v.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>{editItem ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Vehicle Number *" size="small" value={form.vehicle_number}
                                onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="Type" size="small" value={form.vehicle_type}
                                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                                {['bus', 'van', 'mini_bus', 'car', 'auto'].map(t => <MenuItem key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={6}><TextField fullWidth label="Make" size="small" value={form.make || ''} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="Model" size="small" value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField type="number" fullWidth label="Capacity (seats)" size="small" value={form.seating_capacity} onChange={(e) => setForm({ ...form, seating_capacity: +e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="Reg. Number" size="small" value={form.registration_number || ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></Grid>
                        <Grid item xs={6}><TextField fullWidth label="Insurance No." size="small" value={form.insurance_number || ''} onChange={(e) => setForm({ ...form, insurance_number: e.target.value })} /></Grid>
                        <Grid item xs={6}>
                            <Chip icon={<GpsIcon />} label={`GPS ${form.gps_enabled ? 'Enabled' : 'Disabled'}`}
                                color={form.gps_enabled ? 'success' : 'default'}
                                onClick={() => setForm({ ...form, gps_enabled: !form.gps_enabled })}
                                sx={{ cursor: 'pointer', mt: 1 }} />
                        </Grid>
                        <Grid item xs={12}><TextField fullWidth label="Notes" size="small" multiline rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={isCreating || isUpdating}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isCreating || isUpdating ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ── Routes Tab ─────────────────────────────────────────────────────────────────
function RoutesTab({ routes, vehicles, loading }: { routes: TransportRoute[]; vehicles: Vehicle[]; loading: boolean }) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editRoute, setEditRoute] = useState<TransportRoute | null>(null);
    const [stopDialogRoute, setStopDialogRoute] = useState<TransportRoute | null>(null);
    const [editStop, setEditStop] = useState<RouteStop | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const defaultRouteForm = { route_name: '', route_code: '', description: '', monthly_fee: '', vehicle_id: '', driver_id: '', conductor_id: '', pickup_start_time: '', drop_start_time: '', total_distance_km: '', estimated_duration_minutes: '' };
    const [routeForm, setRouteForm] = useState<any>(defaultRouteForm);
    const defaultStopForm = { stop_name: '', stop_order: 1, address: '', landmark: '', pickup_time: '', drop_time: '', monthly_fee: '' };
    const [stopForm, setStopForm] = useState<any>(defaultStopForm);

    const [createRoute, { isLoading: isCreating }] = useCreateRouteMutation();
    const [updateRoute, { isLoading: isUpdatingRoute }] = useUpdateRouteMutation();
    const [deleteRoute] = useDeleteRouteMutation();
    const [updateRouteStatus] = useUpdateRouteStatusMutation();
    const [addStop, { isLoading: isAddingStop }] = useAddRouteStopMutation();
    const [updateStop, { isLoading: isUpdatingStop }] = useUpdateRouteStopMutation();
    const [deleteStop] = useDeleteRouteStopMutation();

    const openCreateRoute = () => { setRouteForm(defaultRouteForm); setEditRoute(null); setCreateOpen(true); };
    const openEditRoute = (r: TransportRoute) => {
        setRouteForm({
            route_name: r.route_name, route_code: r.route_code || '', description: r.description || '',
            monthly_fee: r.monthly_fee ?? '', vehicle_id: r.vehicle_id || '',
            driver_id: r.driver_id || '', conductor_id: r.conductor_id || '',
            pickup_start_time: r.pickup_start_time || '', drop_start_time: r.drop_start_time || '',
            total_distance_km: r.total_distance_km ?? '', estimated_duration_minutes: r.estimated_duration_minutes ?? '',
        });
        setEditRoute(r);
        setCreateOpen(true);
    };

    const handleSaveRoute = async () => {
        if (!routeForm.route_name) { toast.error('Route name required'); return; }
        const payload: any = { ...routeForm };
        // clean empty strings
        for (const k of Object.keys(payload)) {
            if (payload[k] === '') payload[k] = undefined;
        }
        if (payload.monthly_fee) payload.monthly_fee = parseFloat(payload.monthly_fee);
        if (payload.total_distance_km) payload.total_distance_km = parseFloat(payload.total_distance_km);
        if (payload.estimated_duration_minutes) payload.estimated_duration_minutes = parseInt(payload.estimated_duration_minutes);

        try {
            if (editRoute) {
                await updateRoute({ id: editRoute.id, data: payload }).unwrap();
                toast.success('Route updated');
            } else {
                await createRoute(payload).unwrap();
                toast.success('Route created');
            }
            setCreateOpen(false);
        } catch (e: any) { toast.error(e.data?.detail || 'Failed'); }
    };

    const handleDeleteRoute = async (id: string) => {
        if (!window.confirm('Delete this route? This will deactivate it.')) return;
        try { await deleteRoute(id).unwrap(); toast.success('Route deleted'); }
        catch (e: any) { toast.error(e.data?.detail || 'Failed'); }
    };

    const openAddStop = (route: TransportRoute) => {
        setStopDialogRoute(route);
        setEditStop(null);
        setStopForm({ ...defaultStopForm, stop_order: (route.stops?.length ?? 0) + 1 });
    };

    const openEditStop = (route: TransportRoute, stop: RouteStop) => {
        setStopDialogRoute(route);
        setEditStop(stop);
        setStopForm({
            stop_name: stop.stop_name, stop_order: stop.stop_order,
            address: stop.address || '', landmark: stop.landmark || '',
            pickup_time: stop.pickup_time || '', drop_time: stop.drop_time || '',
            monthly_fee: stop.monthly_fee ?? '',
        });
    };

    const handleSaveStop = async () => {
        if (!stopDialogRoute || !stopForm.stop_name) { toast.error('Stop name required'); return; }
        const data: any = {
            stop_name: stopForm.stop_name, stop_order: stopForm.stop_order,
            address: stopForm.address || undefined, landmark: stopForm.landmark || undefined,
            pickup_time: stopForm.pickup_time || undefined, drop_time: stopForm.drop_time || undefined,
            monthly_fee: stopForm.monthly_fee ? parseFloat(stopForm.monthly_fee) : undefined,
        };
        try {
            if (editStop) {
                await updateStop({ routeId: stopDialogRoute.id, stopId: editStop.id, data }).unwrap();
                toast.success('Stop updated');
            } else {
                await addStop({ routeId: stopDialogRoute.id, stop: data }).unwrap();
                toast.success('Stop added');
            }
            setStopDialogRoute(null);
            setEditStop(null);
        } catch (e: any) { toast.error(e.data?.detail || 'Failed'); }
    };

    const handleDeleteStop = async (routeId: string, stopId: string) => {
        if (!window.confirm('Delete this stop?')) return;
        try { await deleteStop({ routeId, stopId }).unwrap(); toast.success('Stop deleted'); }
        catch (e: any) { toast.error(e.data?.detail || 'Failed'); }
    };

    if (loading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateRoute}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    Add Route
                </Button>
            </Box>

            {routes.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No routes yet. Add your first route.</Alert>
            ) : (
                <Grid container spacing={2}>
                    {routes.map((route) => (
                        <Grid item xs={12} md={6} key={route.id}>
                            <Card elevation={0} sx={{ border: '1px solid', borderColor: route.status === 'active' ? 'success.light' : 'divider', borderRadius: 3 }}>
                                <CardContent>
                                    {/* Header */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight={700}>{route.route_name}</Typography>
                                            {route.route_code && <Chip label={route.route_code} size="small" sx={{ mt: 0.5 }} />}
                                        </Box>
                                        <TextField
                                            select value={route.status} size="small"
                                            onChange={(e) => updateRouteStatus({ id: route.id, status: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            sx={{ minWidth: 120, '& .MuiSelect-select': { py: 0.5 } }}
                                            SelectProps={{
                                                renderValue: (val: any) => (
                                                    <Chip icon={STATUS_ICON[val] as any} label={val.charAt(0).toUpperCase() + val.slice(1)}
                                                        size="small" color={STATUS_COLOR[val]} sx={{ cursor: 'pointer' }} />
                                                ),
                                            }}
                                        >
                                            <MenuItem value="active">Active</MenuItem>
                                            <MenuItem value="inactive">Inactive</MenuItem>
                                            <MenuItem value="suspended">Suspended</MenuItem>
                                        </TextField>
                                    </Box>

                                    {route.description && <Typography variant="body2" color="text.secondary" mb={1}>{route.description}</Typography>}

                                    {/* Info chips */}
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                        {route.vehicle_number && (
                                            <Chip icon={<BusIcon />} size="small" variant="outlined"
                                                label={`${route.vehicle_number} (${route.vehicle_type?.replace('_', ' ')})`} />
                                        )}
                                        {route.driver_name && (
                                            <Chip icon={<PersonIcon />} size="small" variant="outlined" color="primary"
                                                label={`Driver: ${route.driver_name}`} />
                                        )}
                                        {route.conductor_name && (
                                            <Chip icon={<PersonIcon />} size="small" variant="outlined" color="secondary"
                                                label={`Conductor: ${route.conductor_name}`} />
                                        )}
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <LocationIcon fontSize="small" color="primary" />
                                            <Typography variant="body2">{route.stops?.length ?? 0} stops</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <PersonIcon fontSize="small" color="secondary" />
                                            <Typography variant="body2">{route.student_count} students</Typography>
                                        </Box>
                                        {route.monthly_fee != null && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <FeeIcon fontSize="small" color="success" />
                                                <Typography variant="body2">₹{route.monthly_fee}/mo</Typography>
                                            </Box>
                                        )}
                                        {route.total_distance_km && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <SpeedIcon fontSize="small" color="info" />
                                                <Typography variant="body2">{route.total_distance_km} km</Typography>
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Stops list — expandable */}
                                    {route.stops && route.stops.length > 0 && (
                                        <>
                                            <Button size="small" onClick={() => setExpanded(expanded === route.id ? null : route.id)}
                                                endIcon={expanded === route.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                sx={{ mt: 1, textTransform: 'none', px: 0 }}>
                                                {expanded === route.id ? 'Hide' : 'Show'} Stops ({route.stops.length})
                                            </Button>
                                            <Collapse in={expanded === route.id}>
                                                <List dense sx={{ bgcolor: 'action.hover', borderRadius: 2, mt: 1 }}>
                                                    {[...route.stops].sort((a, b) => a.stop_order - b.stop_order).map((stop, i) => (
                                                        <ListItem key={stop.id} divider={i < route.stops.length - 1}
                                                            secondaryAction={
                                                                <Box>
                                                                    <Tooltip title="Edit Stop">
                                                                        <IconButton size="small" onClick={() => openEditStop(route, stop)}>
                                                                            <EditIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Remove Stop">
                                                                        <IconButton size="small" color="error" onClick={() => handleDeleteStop(route.id, stop.id)}>
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Box>
                                                            }>
                                                            <ListItemIcon sx={{ minWidth: 28 }}>
                                                                <Typography variant="caption" fontWeight={700} color="primary">{stop.stop_order}</Typography>
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={stop.stop_name}
                                                                secondary={[
                                                                    stop.address,
                                                                    stop.pickup_time ? `↑ ${stop.pickup_time}` : null,
                                                                    stop.drop_time ? `↓ ${stop.drop_time}` : null,
                                                                    stop.monthly_fee ? `₹${stop.monthly_fee}` : null,
                                                                ].filter(Boolean).join('  ·  ')}
                                                            />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </Collapse>
                                        </>
                                    )}
                                </CardContent>
                                <CardActions sx={{ pt: 0, justifyContent: 'flex-end', gap: 0.5 }}>
                                    <Button size="small" startIcon={<AddStopIcon />} onClick={() => openAddStop(route)} sx={{ textTransform: 'none' }}>
                                        Add Stop
                                    </Button>
                                    <Button size="small" startIcon={<EditIcon />} onClick={() => openEditRoute(route)} sx={{ textTransform: 'none' }}>
                                        Edit
                                    </Button>
                                    <Button size="small" startIcon={<DeleteIcon />} color="error" onClick={() => handleDeleteRoute(route.id)} sx={{ textTransform: 'none' }}>
                                        Delete
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create / Edit Route Dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>{editRoute ? 'Edit Route' : 'Add New Route'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={8}>
                            <TextField fullWidth label="Route Name *" size="small" value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField fullWidth label="Route Code" size="small" value={routeForm.route_code} onChange={(e) => setRouteForm({ ...routeForm, route_code: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="Assign Vehicle" size="small" value={routeForm.vehicle_id} onChange={(e) => setRouteForm({ ...routeForm, vehicle_id: e.target.value })}>
                                <MenuItem value="">None</MenuItem>
                                {vehicles.filter(v => v.status === 'active').map(v => <MenuItem key={v.id} value={v.id}>{v.vehicle_number} ({v.vehicle_type})</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField type="number" fullWidth label="Monthly Fee (₹)" size="small" value={routeForm.monthly_fee}
                                onChange={(e) => setRouteForm({ ...routeForm, monthly_fee: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth label="Pickup Time" size="small" placeholder="07:00" value={routeForm.pickup_start_time}
                                onChange={(e) => setRouteForm({ ...routeForm, pickup_start_time: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start"><ScheduleIcon fontSize="small" /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth label="Drop Time" size="small" placeholder="14:30" value={routeForm.drop_start_time}
                                onChange={(e) => setRouteForm({ ...routeForm, drop_start_time: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start"><ScheduleIcon fontSize="small" /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField type="number" fullWidth label="Distance (km)" size="small" value={routeForm.total_distance_km}
                                onChange={(e) => setRouteForm({ ...routeForm, total_distance_km: e.target.value })} />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField type="number" fullWidth label="Duration (mins)" size="small" value={routeForm.estimated_duration_minutes}
                                onChange={(e) => setRouteForm({ ...routeForm, estimated_duration_minutes: e.target.value })} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Description" size="small" multiline rows={2} value={routeForm.description} onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })} />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveRoute} disabled={isCreating || isUpdatingRoute}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isCreating || isUpdatingRoute ? 'Saving…' : editRoute ? 'Update Route' : 'Create Route'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add / Edit Stop Dialog */}
            <Dialog open={!!stopDialogRoute} onClose={() => { setStopDialogRoute(null); setEditStop(null); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>
                    {editStop ? 'Edit' : 'Add'} Stop — <Typography component="span" color="primary">{stopDialogRoute?.route_name}</Typography>
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={8}>
                            <TextField fullWidth label="Stop Name *" size="small" value={stopForm.stop_name} onChange={(e) => setStopForm({ ...stopForm, stop_name: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField type="number" fullWidth label="Order" size="small" value={stopForm.stop_order} onChange={(e) => setStopForm({ ...stopForm, stop_order: +e.target.value })} inputProps={{ min: 1 }} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Address" size="small" value={stopForm.address} onChange={(e) => setStopForm({ ...stopForm, address: e.target.value })} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Landmark" size="small" value={stopForm.landmark} onChange={(e) => setStopForm({ ...stopForm, landmark: e.target.value })} />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField fullWidth label="Pickup Time" size="small" placeholder="07:30" value={stopForm.pickup_time}
                                onChange={(e) => setStopForm({ ...stopForm, pickup_time: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start"><ScheduleIcon fontSize="small" /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField fullWidth label="Drop Time" size="small" placeholder="14:30" value={stopForm.drop_time}
                                onChange={(e) => setStopForm({ ...stopForm, drop_time: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start"><ScheduleIcon fontSize="small" /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField fullWidth label="Stop Fee (₹)" size="small" value={stopForm.monthly_fee}
                                onChange={(e) => setStopForm({ ...stopForm, monthly_fee: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
                        </Grid>
                    </Grid>

                    {/* Show existing stops */}
                    {stopDialogRoute && stopDialogRoute.stops && stopDialogRoute.stops.length > 0 && !editStop && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>EXISTING STOPS</Typography>
                            <List dense sx={{ bgcolor: 'action.hover', borderRadius: 2, mt: 0.5 }}>
                                {[...stopDialogRoute.stops].sort((a, b) => a.stop_order - b.stop_order).map((s) => (
                                    <ListItem key={s.id}>
                                        <ListItemIcon sx={{ minWidth: 24 }}>
                                            <Typography variant="caption" fontWeight={700} color="primary">{s.stop_order}</Typography>
                                        </ListItemIcon>
                                        <ListItemText primary={s.stop_name} secondary={s.address} />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => { setStopDialogRoute(null); setEditStop(null); }}>Close</Button>
                    <Button variant="contained" onClick={handleSaveStop} disabled={isAddingStop || isUpdatingStop}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isAddingStop || isUpdatingStop ? 'Saving…' : editStop ? 'Update Stop' : 'Add Stop'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ── Assignments Tab ────────────────────────────────────────────────────────────
function AssignmentsTab({ assignments, routes, students, loading }: { assignments: any[]; routes: TransportRoute[]; students: any[]; loading: boolean }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ route_id: '', stop_id: '', trip_type: 'both', monthly_fee: '' });
    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    const [assignStudent, { isLoading: isAssigning }] = useAssignStudentMutation();
    const [removeAssignment] = useRemoveAssignmentMutation();

    const selectedRoute = routes.find(r => r.id === form.route_id);

    const handleAssign = async () => {
        if (!selectedStudent || !form.route_id) { toast.error('Select student and route'); return; }
        try {
            await assignStudent({
                student_id: selectedStudent.id,
                route_id: form.route_id,
                stop_id: form.stop_id || undefined,
                trip_type: form.trip_type,
                monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : undefined,
            }).unwrap();
            toast.success('Student assigned');
            setOpen(false);
            setForm({ route_id: '', stop_id: '', trip_type: 'both', monthly_fee: '' });
            setSelectedStudent(null);
        } catch (e: any) { toast.error(e.data?.detail || 'Failed to assign'); }
    };

    const handleRemove = async (id: string) => {
        if (!window.confirm('Remove this assignment?')) return;
        try { await removeAssignment(id).unwrap(); toast.success('Assignment removed'); }
        catch { toast.error('Failed'); }
    };

    if (loading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

    const studentOptions = students.map((s: any) => ({
        id: s.id,
        label: `${s.first_name} ${s.last_name}`,
        admission_number: s.admission_number,
    }));

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setOpen(true)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    Assign Student
                </Button>
            </Box>

            {assignments.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>No assignments yet.</Alert>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell><strong>Student</strong></TableCell>
                                <TableCell><strong>Route</strong></TableCell>
                                <TableCell><strong>Stop</strong></TableCell>
                                <TableCell><strong>Trip</strong></TableCell>
                                <TableCell align="right"><strong>Fee/mo</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {assignments.map((a) => (
                                <TableRow key={a.id} hover>
                                    <TableCell>
                                        <Typography fontWeight={600}>{a.student_name || '—'}</Typography>
                                        {a.student_class && <Typography variant="caption" color="text.secondary">{a.student_class}</Typography>}
                                    </TableCell>
                                    <TableCell>{a.route_name || '—'}</TableCell>
                                    <TableCell>{a.stop_name || <Typography variant="caption" color="text.secondary">Any stop</Typography>}</TableCell>
                                    <TableCell>
                                        <Chip label={a.trip_type.toUpperCase()} size="small"
                                            color={a.trip_type === 'both' ? 'primary' : 'default'} variant="outlined" />
                                    </TableCell>
                                    <TableCell align="right">₹{a.monthly_fee ?? 0}</TableCell>
                                    <TableCell>
                                        <Chip label={a.is_active ? 'Active' : 'Inactive'}
                                            color={a.is_active ? 'success' : 'default'} size="small" />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="Remove Assignment">
                                            <IconButton size="small" color="error" onClick={() => handleRemove(a.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Assign Dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle fontWeight={700}>Assign Student to Route</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12}>
                            <Autocomplete
                                options={studentOptions}
                                getOptionLabel={(s: any) => `${s.label} (${s.admission_number})`}
                                isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
                                value={selectedStudent}
                                onChange={(_, v) => setSelectedStudent(v)}
                                renderOption={(props, option: any) => (
                                    <Box component="li" {...props}>
                                        <Box>
                                            <Typography variant="body2" fontWeight={600}>{option.label}</Typography>
                                            <Typography variant="caption" color="text.secondary">{option.admission_number}</Typography>
                                        </Box>
                                    </Box>
                                )}
                                renderInput={(p) => <TextField {...p} label="Search Student *" size="small" />}
                                noOptionsText="No students found"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField select fullWidth label="Route *" size="small" value={form.route_id}
                                onChange={(e) => setForm({ ...form, route_id: e.target.value, stop_id: '' })}>
                                {routes.filter(r => r.status === 'active').map(r => (
                                    <MenuItem key={r.id} value={r.id}>
                                        {r.route_name} {r.route_code ? `(${r.route_code})` : ''}
                                        {r.vehicle_number ? ` — 🚌 ${r.vehicle_number}` : ''}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        {selectedRoute && selectedRoute.stops?.length > 0 && (
                            <Grid item xs={12}>
                                <TextField select fullWidth label="Board/Alight Stop (optional)" size="small" value={form.stop_id}
                                    onChange={(e) => setForm({ ...form, stop_id: e.target.value })}>
                                    <MenuItem value="">Any stop (bus passes through)</MenuItem>
                                    {[...selectedRoute.stops].sort((a, b) => a.stop_order - b.stop_order).map((s) => (
                                        <MenuItem key={s.id} value={s.id}>
                                            Stop {s.stop_order}: {s.stop_name}{s.monthly_fee ? ` — ₹${s.monthly_fee}` : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                        )}
                        <Grid item xs={6}>
                            <TextField select fullWidth label="Trip Type" size="small" value={form.trip_type}
                                onChange={(e) => setForm({ ...form, trip_type: e.target.value })}>
                                <MenuItem value="both">Both (Pickup & Drop)</MenuItem>
                                <MenuItem value="pickup">Pickup Only</MenuItem>
                                <MenuItem value="drop">Drop Only</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth label="Custom Fee (₹/mo)" size="small" value={form.monthly_fee}
                                onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
                                helperText="Leave blank for stop/route default" />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAssign} disabled={isAssigning}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                        {isAssigning ? 'Assigning…' : 'Assign'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
