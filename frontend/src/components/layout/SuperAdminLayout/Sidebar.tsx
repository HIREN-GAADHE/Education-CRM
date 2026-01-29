import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer,
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Divider,
    Avatar,
    Tooltip,
    useTheme,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Business as TenantIcon,
    CloudQueue as GlobalIcon,
    Settings as SettingsIcon,
    AdminPanelSettings as SuperAdminIcon,
    Security as SecurityIcon,
    Logout as LogoutIcon,
    Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/store/api/authApi';

interface SidebarProps {
    open: boolean;
    collapsed: boolean;
    onClose: () => void;
    width: number;
    collapsedWidth: number;
    isMobile: boolean;
}

const SuperAdminSidebar: React.FC<SidebarProps> = ({
    open,
    collapsed,
    onClose,
    width,
    collapsedWidth,
    isMobile,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useSelector(selectUser);
    const theme = useTheme();
    const dispatch = useDispatch();
    const [logoutApi] = useLogoutMutation();

    const currentWidth = collapsed ? collapsedWidth : width;

    const handleNavigate = (path: string) => {
        navigate(path);
        if (isMobile) {
            onClose();
        }
    };

    const handleLogout = async () => {
        try {
            await logoutApi({}).unwrap();
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            dispatch(logout());
            navigate('/login');
        }
    };

    const menuItems = [
        { label: 'Overview', path: '/dashboard', icon: <DashboardIcon /> },
        { label: 'Universities', path: '/tenants', icon: <TenantIcon /> },
        { label: 'Global Stats', path: '/stats', icon: <AnalyticsIcon /> },
        { label: 'Platform Settings', path: '/settings', icon: <SettingsIcon /> },
        { label: 'System Logs', path: '/logs', icon: <SecurityIcon /> },
    ];

    const drawerContent = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                bgcolor: '#1a1a1a', // Dark background for Super Admin
                color: '#e0e0e0',
            }}
        >
            {/* Logo */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: 3,
                    py: 3,
                }}
            >
                <SuperAdminIcon sx={{ color: '#ff5252', fontSize: 32, mr: collapsed ? 0 : 2 }} />
                {!collapsed && (
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>
                            SUPER ADMIN
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#ff5252' }}>
                            Control Panel
                        </Typography>
                    </Box>
                )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

            {/* Navigation */}
            <Box sx={{ flex: 1, py: 2 }}>
                <List>
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
                                <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                                    <ListItemButton
                                        onClick={() => handleNavigate(item.path)}
                                        selected={isActive}
                                        sx={{
                                            minHeight: 48,
                                            justifyContent: collapsed ? 'center' : 'flex-start',
                                            px: 2.5,
                                            mx: 1,
                                            borderRadius: 1,
                                            '&.Mui-selected': {
                                                bgcolor: 'rgba(255, 82, 82, 0.15)',
                                                '&:hover': {
                                                    bgcolor: 'rgba(255, 82, 82, 0.25)',
                                                },
                                            },
                                            '&:hover': {
                                                bgcolor: 'rgba(255, 255, 255, 0.05)',
                                            },
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: 0,
                                                mr: collapsed ? 0 : 2,
                                                justifyContent: 'center',
                                                color: isActive ? '#ff5252' : '#9e9e9e',
                                            }}
                                        >
                                            {item.icon}
                                        </ListItemIcon>
                                        {!collapsed && (
                                            <ListItemText
                                                primary={item.label}
                                                primaryTypographyProps={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: isActive ? 600 : 400,
                                                    color: isActive ? '#fff' : '#b0b0b0',
                                                }}
                                            />
                                        )}
                                    </ListItemButton>
                                </Tooltip>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

            {/* User Profile / Logout */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        borderRadius: 1,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        color: '#ef5350',
                        '&:hover': { bgcolor: 'rgba(239, 83, 80, 0.1)' }
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2, color: 'inherit' }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    {!collapsed && <ListItemText primary="Logout" />}
                </ListItemButton>
            </Box>
        </Box>
    );

    if (isMobile) {
        return (
            <Drawer
                anchor="left"
                open={open}
                onClose={onClose}
                ModalProps={{ keepMounted: true }}
                sx={{ '& .MuiDrawer-paper': { width: width, boxSizing: 'border-box', bgcolor: '#1a1a1a' } }}
            >
                {drawerContent}
            </Drawer>
        );
    }

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: currentWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: currentWidth,
                    boxSizing: 'border-box',
                    bgcolor: '#1a1a1a',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                    transition: (theme) =>
                        theme.transitions.create('width', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                },
            }}
        >
            {drawerContent}
        </Drawer>
    );
};

export default SuperAdminSidebar;
