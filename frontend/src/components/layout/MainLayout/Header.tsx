import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Box,
    Avatar,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    Badge,
    Tooltip,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Button,
    useTheme,
    Snackbar,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    Menu as MenuIcon,
    Notifications as NotificationsIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Circle as CircleIcon,
    Info as InfoIcon,
    DoneAll as DoneAllIcon,
    Close as CloseIcon,
    MarkEmailRead as MarkEmailReadIcon,
    MarkEmailUnread as MarkEmailUnreadIcon,
} from '@mui/icons-material';
import { selectUser, logout } from '@/store/slices/authSlice';
import { selectTheme, toggleTheme } from '@/store/slices/uiSlice';
import { useLogoutMutation } from '@/store/api/authApi';
import {
    useMarkAllAsReadMutation,
    useGetUnreadCountQuery,
    useGetMessagesQuery,
} from '@/store/api/messageApi';

interface HeaderProps {
    onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector(selectUser);
    const theme = useSelector(selectTheme);
    const muiTheme = useTheme();
    const isDark = muiTheme.palette.mode === 'dark';
    const [logoutApi] = useLogoutMutation();

    // Fetch messages directly for notifications
    const { data: messagesData, refetch: refetchMessages } = useGetMessagesQuery({
        page: 1,
        pageSize: 10,
        folder: 'inbox'
    });
    const { data: unreadData, refetch: refetchUnread } = useGetUnreadCountQuery();
    const [markAllAsRead, { isLoading: isMarkingRead }] = useMarkAllAsReadMutation();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
    const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setAnchorEl(null);
    };

    const handleNotifMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setNotifAnchorEl(event.currentTarget);
    };

    const handleNotifMenuClose = () => {
        setNotifAnchorEl(null);
    };

    const handleThemeToggle = () => {
        dispatch(toggleTheme());
    };

    const handleLogout = async () => {
        handleProfileMenuClose();
        try {
            await logoutApi().unwrap();
        } catch (error) {
            // Ignore error, logout anyway
        }
        dispatch(logout());
        navigate('/login');
    };

    const handleNavigate = (path: string) => {
        handleProfileMenuClose();
        handleNotifMenuClose();
        navigate(path);
    };

    const handleMarkAllAsRead = async () => {
        try {
            const result = await markAllAsRead().unwrap();
            setSnackbar({
                open: true,
                message: `Marked ${result.marked_count} notifications as read`,
                severity: 'success'
            });
            refetchMessages();
            refetchUnread();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to mark notifications as read',
                severity: 'error'
            });
        }
    };

    const handleDismissAll = () => {
        // Just dismiss from UI, don't delete from database
        const allIds = new Set(messages.map(msg => msg.id));
        setDismissedNotifications(allIds);
        setSnackbar({
            open: true,
            message: 'Notifications cleared from view',
            severity: 'info'
        });
        handleNotifMenuClose();
    };

    const handleDismissOne = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissedNotifications(prev => new Set([...prev, id]));
    };

    // Use actual messages from API as notifications
    const messages = messagesData?.items || [];

    // Filter out dismissed notifications
    const visibleNotifications = messages
        .filter(msg => !dismissedNotifications.has(msg.id))
        .map(msg => ({
            id: msg.id,
            title: msg.subject,
            time: msg.sent_at ? new Date(msg.sent_at).toLocaleString() : 'Recently',
            type: msg.priority,
            icon: <InfoIcon fontSize="small" />,
            color: msg.priority === 'urgent' ? '#dc2626' : msg.priority === 'high' ? '#d97706' : '#4f46e5',
            isRead: msg.status === 'read',
        }));

    // Use actual unread count from API, default to 0
    const unreadCount = unreadData?.unread_count ?? messagesData?.unread_count ?? 0;

    return (
        <>
            <AppBar
                position="sticky"
                color="inherit"
                sx={{
                    backgroundColor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={onToggleSidebar}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        {/* Page title can be shown here */}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {/* Theme toggle */}
                        <Tooltip title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                            <IconButton color="inherit" onClick={handleThemeToggle}>
                                {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                            </IconButton>
                        </Tooltip>

                        {/* Notifications */}
                        <Tooltip title="Notifications">
                            <IconButton color="inherit" onClick={handleNotifMenuOpen}>
                                <Badge badgeContent={unreadCount} color="error" max={99}>
                                    <NotificationsIcon />
                                </Badge>
                            </IconButton>
                        </Tooltip>

                        {/* Profile */}
                        <Tooltip title="Account">
                            <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0, ml: 1 }}>
                                <Avatar
                                    src={user?.avatar_url}
                                    alt={user?.first_name}
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        bgcolor: 'primary.main',
                                    }}
                                >
                                    {user?.first_name?.[0]}
                                </Avatar>
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Profile Menu */}
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleProfileMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            sx: {
                                mt: 1,
                                minWidth: 220,
                            },
                        }}
                    >
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                                {user?.full_name || user?.first_name || 'User'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {user?.email || 'admin@school.com'}
                            </Typography>
                        </Box>
                        <Divider />
                        <MenuItem onClick={() => handleNavigate('/profile')}>
                            <ListItemIcon>
                                <PersonIcon fontSize="small" />
                            </ListItemIcon>
                            Profile
                        </MenuItem>
                        <MenuItem onClick={() => handleNavigate('/settings')}>
                            <ListItemIcon>
                                <SettingsIcon fontSize="small" />
                            </ListItemIcon>
                            Settings
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
                            </ListItemIcon>
                            Logout
                        </MenuItem>
                    </Menu>

                    {/* Notifications Menu */}
                    <Menu
                        anchorEl={notifAnchorEl}
                        open={Boolean(notifAnchorEl)}
                        onClose={handleNotifMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            sx: {
                                mt: 1,
                                width: 380,
                                maxHeight: 500,
                            },
                        }}
                    >
                        {/* Header with actions */}
                        <Box sx={{
                            px: 2,
                            py: 1.5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    Notifications
                                </Typography>
                                {unreadCount > 0 && (
                                    <Badge
                                        badgeContent={unreadCount}
                                        color="error"
                                        max={99}
                                        sx={{ '& .MuiBadge-badge': { position: 'relative', transform: 'none' } }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Mark all as read">
                                    <span>
                                        <IconButton
                                            size="small"
                                            onClick={handleMarkAllAsRead}
                                            disabled={isMarkingRead || unreadCount === 0}
                                        >
                                            {isMarkingRead ? (
                                                <CircularProgress size={18} />
                                            ) : (
                                                <DoneAllIcon fontSize="small" />
                                            )}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title="Dismiss all from view">
                                    <span>
                                        <IconButton
                                            size="small"
                                            onClick={handleDismissAll}
                                            disabled={visibleNotifications.length === 0}
                                            sx={{ color: visibleNotifications.length > 0 ? 'text.secondary' : 'text.disabled' }}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                        </Box>

                        {visibleNotifications.length === 0 ? (
                            <Box sx={{ py: 4, textAlign: 'center' }}>
                                <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                <Typography color="text.secondary">
                                    No notifications
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    You're all caught up!
                                </Typography>
                            </Box>
                        ) : (
                            <List sx={{ py: 0, maxHeight: 350, overflow: 'auto' }}>
                                {visibleNotifications.map((notif) => (
                                    <ListItem
                                        key={notif.id}
                                        secondaryAction={
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={(e) => handleDismissOne(notif.id, e)}
                                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        }
                                        sx={{
                                            py: 1.5,
                                            px: 2,
                                            backgroundColor: notif.isRead
                                                ? 'transparent'
                                                : isDark ? 'rgba(79, 70, 229, 0.08)' : 'rgba(79, 70, 229, 0.04)',
                                            borderLeft: notif.isRead ? 'none' : '3px solid',
                                            borderColor: 'primary.main',
                                            '&:hover': {
                                                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                            },
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Avatar
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    bgcolor: `${notif.color}15`,
                                                    color: notif.color,
                                                }}
                                            >
                                                {notif.icon}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={notif.title}
                                            secondary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {notif.time}
                                                    </Typography>
                                                    {notif.isRead ? (
                                                        <Tooltip title="Read">
                                                            <MarkEmailReadIcon sx={{ fontSize: 12, color: 'success.main' }} />
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Unread">
                                                            <MarkEmailUnreadIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            }
                                            primaryTypographyProps={{
                                                fontSize: '0.875rem',
                                                fontWeight: notif.isRead ? 400 : 600,
                                                noWrap: true,
                                            }}
                                        />
                                        {!notif.isRead && (
                                            <CircleIcon sx={{ fontSize: 8, color: 'primary.main', mr: 1 }} />
                                        )}
                                    </ListItem>
                                ))}
                            </List>
                        )}

                        <Divider />
                        <Box sx={{ p: 1 }}>
                            <Button
                                fullWidth
                                size="small"
                                onClick={() => handleNavigate('/communication')}
                                sx={{ textTransform: 'none' }}
                            >
                                View All Messages
                            </Button>
                        </Box>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Snackbar for feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default Header;
