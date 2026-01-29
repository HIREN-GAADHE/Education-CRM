import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Chip,
    IconButton,
    Tooltip,
    Stack
} from '@mui/material';
import {
    Key as KeyIcon,
    Settings as SettingsIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    Block as BlockIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { TenantStats } from '@/store/api/superAdminApi';
import { useNavigate } from 'react-router-dom';

// All available modules in the system (matching actual project modules)
const ALL_MODULES = ['students', 'courses', 'attendance', 'staff', 'fees', 'calendar', 'reports', 'communication'];


interface TenantTableProps {
    tenants: TenantStats[];
    onManageAdmin: (tenant: TenantStats) => void;
    onManageModules: (tenant: TenantStats) => void;
    onDelete: (tenant: TenantStats) => void;
    onToggleStatus: (tenant: TenantStats) => void;
}

const TenantTable: React.FC<TenantTableProps> = ({
    tenants,
    onManageAdmin,
    onManageModules,
    onDelete,
    onToggleStatus
}) => {
    const navigate = useNavigate();

    const getActiveModules = (restrictedModules: string[] = []) => {
        return ALL_MODULES.filter(m => !restrictedModules.includes(m));
    };

    const formatModules = (modules: string[]) => {
        return modules.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
    };

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Slug</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Users</TableCell>
                        <TableCell>Module Access</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {tenants.map((tenant) => {
                        const activeModules = getActiveModules(tenant.restricted_modules);
                        const restrictedModules = tenant.restricted_modules || [];

                        return (
                            <TableRow key={tenant.id} hover>
                                <TableCell
                                    sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                    onClick={() => navigate(`/tenants/${tenant.id}`)}
                                >
                                    <Typography fontWeight={500}>{tenant.name}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip label={tenant.slug} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={tenant.status}
                                        color={tenant.status === 'active' ? 'success' : 'default'}
                                        size="small"
                                        onClick={() => onToggleStatus(tenant)}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                </TableCell>
                                <TableCell>{tenant.total_users}</TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Tooltip
                                            title={activeModules.length > 0 ? `Active: ${formatModules(activeModules)}` : 'No active modules'}
                                            arrow
                                        >
                                            <Chip
                                                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                                                label={`${activeModules.length} Active`}
                                                color="success"
                                                size="small"
                                                variant="outlined"
                                                sx={{ cursor: 'help' }}
                                            />
                                        </Tooltip>
                                        {restrictedModules.length > 0 && (
                                            <Tooltip
                                                title={`Restricted: ${formatModules(restrictedModules)}`}
                                                arrow
                                            >
                                                <Chip
                                                    icon={<BlockIcon sx={{ fontSize: 16 }} />}
                                                    label={`${restrictedModules.length} Blocked`}
                                                    color="error"
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ cursor: 'help' }}
                                                />
                                            </Tooltip>
                                        )}
                                    </Stack>
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Manage Admin">
                                        <IconButton size="small" onClick={() => onManageAdmin(tenant)}>
                                            <KeyIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit Details & Logo">
                                        <IconButton size="small" onClick={() => navigate(`/tenants/${tenant.id}`)} color="info">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Manage Modules">
                                        <IconButton size="small" onClick={() => onManageModules(tenant)} color="primary">
                                            <SettingsIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete University">
                                        <IconButton size="small" onClick={() => onDelete(tenant)} color="error">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Paper>
    );
};

export default TenantTable;

