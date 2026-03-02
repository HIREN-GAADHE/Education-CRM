import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Typography, Tooltip, Avatar
} from '@mui/material';
import {
    DashboardRounded as DashboardIcon,
    CorporateFareRounded as TenantIcon,
    SettingsRounded as SettingsIcon,
    SecurityRounded as SecurityIcon,
    LogoutRounded as LogoutIcon,
    InsightsRounded as AnalyticsIcon,
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { logout } from '@/store/slices/authSlice';
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
    open, collapsed, onClose, width, collapsedWidth, isMobile,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const [logoutApi] = useLogoutMutation();
    const currentWidth = collapsed ? collapsedWidth : width;

    const go = (path: string) => { navigate(path); isMobile && onClose(); };

    const handleLogout = async () => {
        try { await logoutApi().unwrap(); } catch { /* silent */ }
        dispatch(logout());
        navigate('/login');
    };

    const menuItems = [
        { label: 'Overview', path: '/dashboard', icon: <DashboardIcon />, color: '#4f46e5' },
        { label: 'Universities', path: '/tenants', icon: <TenantIcon />, color: '#0ea5e9' },
        { label: 'Analytics', path: '/stats', icon: <AnalyticsIcon />, color: '#10b981' },
        { label: 'Settings', path: '/settings', icon: <SettingsIcon />, color: '#f59e0b' },
        { label: 'Audit Logs', path: '/logs', icon: <SecurityIcon />, color: '#8b5cf6' },
    ];

    const content = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#e2e8f0', p: 2, gap: 2 }}>

            {/* ── Brand 3D Card ─────────────────────────────────────────────────── */}
            <Box sx={{
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                p: collapsed ? 1.5 : 2.5, gap: 2,
                bgcolor: '#f8fafc',
                borderRadius: '20px',
                boxShadow: '10px 10px 20px #c1c8d1, -10px -10px 20px #ffffff, inset 0 2px 0 rgba(255,255,255,0.8)',
            }}>
                <Avatar sx={{
                    borderRadius: '14px',
                    width: 48, height: 48,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4), inset 0 2px 2px rgba(255,255,255,0.3)',
                    border: '2px solid #ffffff'
                }}>
                    <Typography fontWeight={900} fontSize={22} color="white">E</Typography>
                </Avatar>
                {!collapsed && (
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                            EduSphere
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#4f46e5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Super Admin
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* ── Nav ───────────────────────────────────────────────────── */}
            <Box sx={{ flex: 1, mt: 1 }}>
                <List disablePadding>
                    {menuItems.map((item) => {
                        const active = location.pathname === item.path ||
                            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                        return (
                            <ListItem key={item.path} disablePadding sx={{ mb: 2 }}>
                                <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                                    <ListItemButton
                                        onClick={() => go(item.path)}
                                        selected={active}
                                        sx={{
                                            minHeight: 56,
                                            justifyContent: collapsed ? 'center' : 'flex-start',
                                            px: 2, borderRadius: '16px',
                                            bgcolor: active ? '#f8fafc' : 'transparent',
                                            boxShadow: active ? 'inset 5px 5px 10px #e2e8f0, inset -5px -5px 10px #ffffff' : 'none',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            '&.Mui-selected': {
                                                bgcolor: '#f8fafc',
                                                '&:hover': { bgcolor: '#f8fafc' },
                                            },
                                            '&:hover': {
                                                bgcolor: '#f1f5f9',
                                                boxShadow: !active ? '5px 5px 10px #c1c8d1, -5px -5px 10px #ffffff' : 'inset 5px 5px 10px #e2e8f0, inset -5px -5px 10px #ffffff',
                                                transform: !active ? 'translateY(-2px)' : 'none'
                                            },
                                        }}
                                    >
                                        <ListItemIcon sx={{
                                            minWidth: 0, mr: collapsed ? 0 : 2.5,
                                            justifyContent: 'center',
                                            color: active ? item.color : '#64748b',
                                            transition: 'transform 0.2s',
                                            transform: active ? 'scale(1.2)' : 'scale(1)',
                                            filter: active ? `drop-shadow(0 4px 6px ${item.color}40)` : 'none',
                                        }}>
                                            {item.icon}
                                        </ListItemIcon>
                                        {!collapsed && (
                                            <ListItemText
                                                primary={item.label}
                                                primaryTypographyProps={{
                                                    fontSize: '1rem',
                                                    fontWeight: active ? 800 : 700,
                                                    color: active ? '#0f172a' : '#475569',
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

            {/* ── Logout 3D Button ────────────────────────────────────────────────── */}
            <Box>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        borderRadius: '16px', minHeight: 56,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        color: '#ef4444',
                        px: 2,
                        bgcolor: '#f8fafc',
                        boxShadow: '8px 8px 16px #c1c8d1, -8px -8px 16px #ffffff',
                        border: '1px solid #ffffff',
                        '&:hover': {
                            boxShadow: 'inset 5px 5px 10px #e2e8f0, inset -5px -5px 10px #ffffff',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 2.5, color: '#ef4444' }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    {!collapsed && (
                        <ListItemText
                            primary="Secure Sign Out"
                            primaryTypographyProps={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}
                        />
                    )}
                </ListItemButton>
            </Box>
        </Box>
    );

    if (isMobile) {
        return (
            <Drawer
                anchor="left" open={open} onClose={onClose}
                ModalProps={{ keepMounted: true }}
                sx={{ '& .MuiDrawer-paper': { width, boxSizing: 'border-box', bgcolor: '#e2e8f0', border: 'none' } }}
            >
                {content}
            </Drawer>
        );
    }

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: currentWidth, flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: currentWidth, boxSizing: 'border-box',
                    bgcolor: '#e2e8f0', border: 'none',
                    transition: (t) => t.transitions.create('width', {
                        easing: t.transitions.easing.sharp,
                        duration: t.transitions.duration.enteringScreen,
                    }),
                },
            }}
        >
            {content}
        </Drawer>
    );
};

export default SuperAdminSidebar;
