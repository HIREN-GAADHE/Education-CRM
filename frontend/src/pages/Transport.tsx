import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Tabs, Tab, Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
    Alert, CircularProgress, List, ListItem, ListItemText,
    ListItemIcon, Divider, Snackbar, Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    DirectionsBus as BusIcon,
    Route as RouteIcon,
    Person as PersonIcon,
    LocationOn as LocationIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Speed as SpeedIcon,
    PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import {
    useGetVehiclesQuery,
    useCreateVehicleMutation,
    useDeleteVehicleMutation,
    useUpdateVehicleMutation,
    useGetRoutesQuery,
    useCreateRouteMutation,
    useGetAssignmentsQuery,
    useAssignStudentMutation,
    useRemoveAssignmentMutation,
    useGetTransportStatsQuery,
    Vehicle,
    TransportRoute,
} from '../store/api/transportApi';
import { useGetStudentsQuery } from '../store/api/studentApi';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const TransportPage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
    const [routeDialogOpen, setRouteDialogOpen] = useState(false);
    const [editVehicleDialogOpen, setEditVehicleDialogOpen] = useState(false);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // API Queries
    const { data: vehiclesData, isLoading: vehiclesLoading } = useGetVehiclesQuery({ page: 1, pageSize: 50 });
    const { data: routesData, isLoading: routesLoading } = useGetRoutesQuery({ page: 1, pageSize: 50 });
    const { data: assignmentsData, isLoading: assignmentsLoading } = useGetAssignmentsQuery({ page: 1, pageSize: 50 });
    const { data: stats } = useGetTransportStatsQuery();
    const { data: studentsData } = useGetStudentsQuery({ page: 1, page_size: 100 });

    // Mutations
    const [createVehicle, { isLoading: creatingVehicle }] = useCreateVehicleMutation();
    const [deleteVehicle] = useDeleteVehicleMutation();
    const [updateVehicle, { isLoading: updatingVehicle }] = useUpdateVehicleMutation();
    const [createRoute, { isLoading: creatingRoute }] = useCreateRouteMutation();
    const [assignStudent, { isLoading: assigningStudent }] = useAssignStudentMutation();
    const [removeAssignment] = useRemoveAssignmentMutation();

    // Vehicle form state
    const [vehicleForm, setVehicleForm] = useState({
        vehicle_number: '',
        vehicle_type: 'bus',
        make: '',
        model: '',
        seating_capacity: 40,
    });

    // Edit vehicle state
    const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
    const [editVehicleForm, setEditVehicleForm] = useState({
        vehicle_number: '',
        vehicle_type: 'bus',
        make: '',
        model: '',
        seating_capacity: 40,
    });

    // Route form state
    const [routeForm, setRouteForm] = useState({
        route_name: '',
        route_code: '',
        description: '',
        monthly_fee: 500,
    });

    // Assignment form state
    const [assignForm, setAssignForm] = useState({
        student_id: '',
        route_id: '',
        trip_type: 'both',
        monthly_fee: 0,
    });

    const handleCreateVehicle = async () => {
        if (!vehicleForm.vehicle_number) {
            setSnackbar({ open: true, message: 'Please enter vehicle number', severity: 'error' });
            return;
        }
        try {
            await createVehicle(vehicleForm).unwrap();
            setVehicleDialogOpen(false);
            setVehicleForm({
                vehicle_number: '',
                vehicle_type: 'bus',
                make: '',
                model: '',
                seating_capacity: 40,
            });
            setSnackbar({ open: true, message: 'Vehicle created successfully!', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to create vehicle', severity: 'error' });
        }
    };

    const handleEditVehicleOpen = (vehicle: Vehicle) => {
        setEditVehicle(vehicle);
        setEditVehicleForm({
            vehicle_number: vehicle.vehicle_number,
            vehicle_type: vehicle.vehicle_type,
            make: vehicle.make || '',
            model: vehicle.model || '',
            seating_capacity: vehicle.seating_capacity,
        });
        setEditVehicleDialogOpen(true);
    };

    const handleUpdateVehicle = async () => {
        if (!editVehicle) return;
        try {
            await updateVehicle({ id: editVehicle.id, data: editVehicleForm }).unwrap();
            setEditVehicleDialogOpen(false);
            setEditVehicle(null);
            setSnackbar({ open: true, message: 'Vehicle updated successfully!', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to update vehicle', severity: 'error' });
        }
    };

    const handleCreateRoute = async () => {
        if (!routeForm.route_name) {
            setSnackbar({ open: true, message: 'Please enter route name', severity: 'error' });
            return;
        }
        try {
            await createRoute(routeForm).unwrap();
            setRouteDialogOpen(false);
            setRouteForm({
                route_name: '',
                route_code: '',
                description: '',
                monthly_fee: 500,
            });
            setSnackbar({ open: true, message: 'Route created successfully!', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to create route', severity: 'error' });
        }
    };

    const handleAssignStudent = async () => {
        if (!assignForm.student_id || !assignForm.route_id) {
            setSnackbar({ open: true, message: 'Please select student and route', severity: 'error' });
            return;
        }
        try {
            await assignStudent({
                student_id: assignForm.student_id,
                route_id: assignForm.route_id,
                trip_type: assignForm.trip_type,
                monthly_fee: assignForm.monthly_fee || undefined,
            }).unwrap();
            setAssignDialogOpen(false);
            setAssignForm({ student_id: '', route_id: '', trip_type: 'both', monthly_fee: 0 });
            setSnackbar({ open: true, message: 'Student assigned successfully!', severity: 'success' });
        } catch (error: any) {
            setSnackbar({ open: true, message: error.data?.detail || 'Failed to assign student', severity: 'error' });
        }
    };

    const handleDeleteVehicle = async (id: string) => {
        if (confirm('Are you sure you want to delete this vehicle?')) {
            try {
                await deleteVehicle(id).unwrap();
                setSnackbar({ open: true, message: 'Vehicle deleted', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to delete', severity: 'error' });
            }
        }
    };

    const handleRemoveAssignment = async (id: string) => {
        if (confirm('Are you sure you want to remove this assignment?')) {
            try {
                await removeAssignment(id).unwrap();
                setSnackbar({ open: true, message: 'Assignment removed', severity: 'success' });
            } catch (error: any) {
                setSnackbar({ open: true, message: error.data?.detail || 'Failed to remove', severity: 'error' });
            }
        }
    };

    const getVehicleTypeIcon = (type: string) => {
        return <BusIcon />;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'maintenance': return 'warning';
            case 'inactive': return 'error';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    <BusIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Transport Management
                </Typography>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <BusIcon sx={{ fontSize: 40 }} />
                            <Typography variant="h4">{stats?.total_vehicles || 0}</Typography>
                            <Typography>Vehicles</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <SpeedIcon sx={{ fontSize: 40 }} />
                            <Typography variant="h4">{stats?.active_vehicles || 0}</Typography>
                            <Typography>Active</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <RouteIcon sx={{ fontSize: 40 }} />
                            <Typography variant="h4">{stats?.total_routes || 0}</Typography>
                            <Typography>Routes</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <LocationIcon sx={{ fontSize: 40 }} />
                            <Typography variant="h4">{stats?.total_stops || 0}</Typography>
                            <Typography>Stops</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                    <Card sx={{ bgcolor: 'secondary.main', color: 'white' }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <PersonIcon sx={{ fontSize: 40 }} />
                            <Typography variant="h4">{stats?.total_students || 0}</Typography>
                            <Typography>Students</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab icon={<BusIcon />} label="Vehicles" />
                    <Tab icon={<RouteIcon />} label="Routes" />
                    <Tab icon={<PersonIcon />} label="Assignments" />
                </Tabs>

                {/* Vehicles Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setVehicleDialogOpen(true)}>
                            Add Vehicle
                        </Button>
                    </Box>
                    {vehiclesLoading ? (
                        <CircularProgress />
                    ) : vehiclesData?.items?.length === 0 ? (
                        <Alert severity="info">No vehicles found. Add your first vehicle.</Alert>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell>Vehicle Number</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Make/Model</TableCell>
                                        <TableCell>Capacity</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>GPS</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {vehiclesData?.items?.map((vehicle) => (
                                        <TableRow key={vehicle.id} hover>
                                            <TableCell sx={{ fontWeight: 'bold' }}>{vehicle.vehicle_number}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getVehicleTypeIcon(vehicle.vehicle_type)}
                                                    label={vehicle.vehicle_type.toUpperCase()}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                                            <TableCell>{vehicle.seating_capacity} seats</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={vehicle.status}
                                                    color={getStatusColor(vehicle.status) as any}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={vehicle.gps_enabled ? 'Enabled' : 'Disabled'}
                                                    color={vehicle.gps_enabled ? 'success' : 'default'}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <IconButton size="small" onClick={() => handleEditVehicleOpen(vehicle)}>
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleDeleteVehicle(vehicle.id)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>

                {/* Routes Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRouteDialogOpen(true)}>
                            Add Route
                        </Button>
                    </Box>
                    {routesLoading ? (
                        <CircularProgress />
                    ) : routesData?.items?.length === 0 ? (
                        <Alert severity="info">No routes found. Add your first route.</Alert>
                    ) : (
                        <Grid container spacing={3}>
                            {routesData?.items?.map((route) => (
                                <Grid item xs={12} md={6} lg={4} key={route.id}>
                                    <Card>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Box>
                                                    <Typography variant="h6">{route.route_name}</Typography>
                                                    {route.route_code && (
                                                        <Chip label={route.route_code} size="small" sx={{ mt: 0.5 }} />
                                                    )}
                                                </Box>
                                                <Chip
                                                    label={route.status}
                                                    color={getStatusColor(route.status) as any}
                                                    size="small"
                                                />
                                            </Box>
                                            {route.description && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                    {route.description}
                                                </Typography>
                                            )}
                                            <Divider sx={{ my: 2 }} />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2">
                                                    <LocationIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                                                    {route.stops?.length || 0} stops
                                                </Typography>
                                                <Typography variant="body2">
                                                    <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                                                    {route.student_count} students
                                                </Typography>
                                            </Box>
                                            {route.monthly_fee && (
                                                <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                                                    ₹{route.monthly_fee}/month
                                                </Typography>
                                            )}
                                            {route.stops && route.stops.length > 0 && (
                                                <Box sx={{ mt: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">Stops:</Typography>
                                                    <List dense>
                                                        {route.stops.slice(0, 3).map((stop, idx) => (
                                                            <ListItem key={stop.id} sx={{ py: 0 }}>
                                                                <ListItemIcon sx={{ minWidth: 24 }}>
                                                                    <Typography variant="caption">{idx + 1}.</Typography>
                                                                </ListItemIcon>
                                                                <ListItemText primary={stop.stop_name} primaryTypographyProps={{ variant: 'body2' }} />
                                                            </ListItem>
                                                        ))}
                                                        {route.stops.length > 3 && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                +{route.stops.length - 3} more stops
                                                            </Typography>
                                                        )}
                                                    </List>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </TabPanel>

                {/* Assignments Tab */}
                <TabPanel value={tabValue} index={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setAssignDialogOpen(true)}>
                            Assign Student
                        </Button>
                    </Box>
                    {assignmentsLoading ? (
                        <CircularProgress />
                    ) : assignmentsData?.items?.length === 0 ? (
                        <Alert severity="info">No student transport assignments found.</Alert>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell>Student</TableCell>
                                        <TableCell>Route</TableCell>
                                        <TableCell>Stop</TableCell>
                                        <TableCell>Trip Type</TableCell>
                                        <TableCell>Fee</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {assignmentsData?.items?.map((assignment) => (
                                        <TableRow key={assignment.id} hover>
                                            <TableCell sx={{ fontWeight: 'bold' }}>{assignment.student_name || '-'}</TableCell>
                                            <TableCell>{assignment.route_name || '-'}</TableCell>
                                            <TableCell>{assignment.stop_name || 'Any'}</TableCell>
                                            <TableCell>
                                                <Chip label={assignment.trip_type.toUpperCase()} size="small" />
                                            </TableCell>
                                            <TableCell>₹{assignment.monthly_fee || 0}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={assignment.is_active ? 'Active' : 'Inactive'}
                                                    color={assignment.is_active ? 'success' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <IconButton size="small" color="error" onClick={() => handleRemoveAssignment(assignment.id)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </TabPanel>
            </Paper>

            {/* Add Vehicle Dialog */}
            <Dialog open={vehicleDialogOpen} onClose={() => setVehicleDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Vehicle</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Vehicle Number"
                                value={vehicleForm.vehicle_number}
                                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_number: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    label="Type"
                                    value={vehicleForm.vehicle_type}
                                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
                                >
                                    <MenuItem value="bus">Bus</MenuItem>
                                    <MenuItem value="van">Van</MenuItem>
                                    <MenuItem value="mini_bus">Mini Bus</MenuItem>
                                    <MenuItem value="car">Car</MenuItem>
                                    <MenuItem value="auto">Auto</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Seating Capacity"
                                type="number"
                                value={vehicleForm.seating_capacity}
                                onChange={(e) => setVehicleForm({ ...vehicleForm, seating_capacity: parseInt(e.target.value) || 40 })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Make"
                                value={vehicleForm.make}
                                onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Model"
                                value={vehicleForm.model}
                                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setVehicleDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateVehicle}
                        disabled={creatingVehicle || !vehicleForm.vehicle_number}
                    >
                        {creatingVehicle ? 'Adding...' : 'Add Vehicle'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Vehicle Dialog */}
            <Dialog open={editVehicleDialogOpen} onClose={() => setEditVehicleDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Vehicle</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Vehicle Number"
                                value={editVehicleForm.vehicle_number}
                                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, vehicle_number: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    label="Type"
                                    value={editVehicleForm.vehicle_type}
                                    onChange={(e) => setEditVehicleForm({ ...editVehicleForm, vehicle_type: e.target.value })}
                                >
                                    <MenuItem value="bus">Bus</MenuItem>
                                    <MenuItem value="van">Van</MenuItem>
                                    <MenuItem value="mini_bus">Mini Bus</MenuItem>
                                    <MenuItem value="car">Car</MenuItem>
                                    <MenuItem value="auto">Auto</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Seating Capacity"
                                type="number"
                                value={editVehicleForm.seating_capacity}
                                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, seating_capacity: parseInt(e.target.value) || 40 })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Make"
                                value={editVehicleForm.make}
                                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, make: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Model"
                                value={editVehicleForm.model}
                                onChange={(e) => setEditVehicleForm({ ...editVehicleForm, model: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditVehicleDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleUpdateVehicle}
                        disabled={updatingVehicle}
                    >
                        {updatingVehicle ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Route Dialog */}
            <Dialog open={routeDialogOpen} onClose={() => setRouteDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Route</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Route Name"
                                value={routeForm.route_name}
                                onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })}
                                required
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Route Code"
                                value={routeForm.route_code}
                                onChange={(e) => setRouteForm({ ...routeForm, route_code: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Monthly Fee (₹)"
                                type="number"
                                value={routeForm.monthly_fee}
                                onChange={(e) => setRouteForm({ ...routeForm, monthly_fee: parseInt(e.target.value) || 0 })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                multiline
                                rows={2}
                                value={routeForm.description}
                                onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRouteDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateRoute}
                        disabled={creatingRoute || !routeForm.route_name}
                    >
                        {creatingRoute ? 'Adding...' : 'Add Route'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Assign Student Dialog */}
            <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign Student to Transport</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Student</InputLabel>
                                <Select
                                    label="Student"
                                    value={assignForm.student_id}
                                    onChange={(e) => setAssignForm({ ...assignForm, student_id: e.target.value })}
                                >
                                    {studentsData?.items?.map((student: any) => (
                                        <MenuItem key={student.id} value={student.id}>
                                            {student.first_name} {student.last_name} - {student.admission_number}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Route</InputLabel>
                                <Select
                                    label="Route"
                                    value={assignForm.route_id}
                                    onChange={(e) => setAssignForm({ ...assignForm, route_id: e.target.value })}
                                >
                                    {routesData?.items?.map((route) => (
                                        <MenuItem key={route.id} value={route.id}>
                                            {route.route_name} {route.route_code ? `(${route.route_code})` : ''}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth>
                                <InputLabel>Trip Type</InputLabel>
                                <Select
                                    label="Trip Type"
                                    value={assignForm.trip_type}
                                    onChange={(e) => setAssignForm({ ...assignForm, trip_type: e.target.value })}
                                >
                                    <MenuItem value="both">Both (Pickup & Drop)</MenuItem>
                                    <MenuItem value="pickup">Pickup Only</MenuItem>
                                    <MenuItem value="drop">Drop Only</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Monthly Fee (₹)"
                                type="number"
                                value={assignForm.monthly_fee}
                                onChange={(e) => setAssignForm({ ...assignForm, monthly_fee: parseInt(e.target.value) || 0 })}
                                helperText="Leave 0 to use route default fee"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleAssignStudent}
                        disabled={assigningStudent || !assignForm.student_id || !assignForm.route_id}
                    >
                        {assigningStudent ? 'Assigning...' : 'Assign Student'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
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

export default TransportPage;
