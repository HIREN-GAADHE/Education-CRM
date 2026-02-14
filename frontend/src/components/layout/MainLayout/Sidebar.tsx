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
    Chip,
    useTheme,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    Security as SecurityIcon,
    Settings as SettingsIcon,
    School as SchoolIcon,
    MenuBook as CoursesIcon,
    Assessment as ReportsIcon,
    Payments as PaymentsIcon,
    EventNote as AttendanceIcon,
    Badge as StaffIcon,
    CalendarMonth as CalendarIcon,
    Chat as CommunicationIcon,
    Schedule as TimetableIcon,
    Quiz as ExamIcon,
    CreditCard as OnlinePaymentsIcon,

    Storefront as MarketplaceIcon,
    Class as ClassIcon, // Added
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectUser, selectRestrictedModules, selectRoleLevel } from '@/store/slices/authSlice';
import { selectInstitutionName, selectInstitutionLogoUrl } from '@/store/slices/uiSlice';

interface SidebarProps {
    open: boolean;
    collapsed: boolean;
    onClose: () => void;
    width: number;
    collapsedWidth: number;
    isMobile: boolean;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    moduleKey?: string;  // Links to restrictable module
}

// Define navigation with module keys for restriction filtering
const navSections: NavSection[] = [
    {
        title: 'Main',
        items: [
            { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
            { label: 'Calendar', path: '/calendar', icon: <CalendarIcon />, moduleKey: 'calendar' },
        ],
    },
    {
        title: 'Academic',
        items: [
            { label: 'Classes', path: '/classes', icon: <ClassIcon />, moduleKey: 'students' }, // Added
            { label: 'Students', path: '/students', icon: <SchoolIcon />, moduleKey: 'students' },
            { label: 'Courses', path: '/courses', icon: <CoursesIcon />, moduleKey: 'courses' },
            { label: 'Attendance', path: '/attendance', icon: <AttendanceIcon />, moduleKey: 'attendance' },
            { label: 'Timetable', path: '/timetable', icon: <TimetableIcon />, moduleKey: 'timetable' },
            { label: 'Examinations', path: '/examinations', icon: <ExamIcon />, moduleKey: 'examinations' },

        ],
    },
    {
        title: 'Administration',
        items: [
            { label: 'Staff', path: '/staff', icon: <StaffIcon />, moduleKey: 'staff' },
            { label: 'Fees & Finance', path: '/fees', icon: <PaymentsIcon />, moduleKey: 'fees' },
            { label: 'Online Payments', path: '/payments', icon: <OnlinePaymentsIcon />, moduleKey: 'payments' },
        ],
    },
    {
        title: 'Communication',
        items: [
            { label: 'Messages', path: '/communication', icon: <CommunicationIcon />, moduleKey: 'communication' },
            { label: 'Reports', path: '/reports', icon: <ReportsIcon />, moduleKey: 'reports' },
        ],
    },
    {
        title: 'Services',
        items: [
            { label: 'L&D Hub', path: '/marketplace', icon: <MarketplaceIcon />, badge: 'Pro', badgeColor: 'info', moduleKey: 'marketplace' },
        ],
    },
    {
        title: 'System',
        items: [
            { label: 'Users', path: '/users', icon: <PeopleIcon />, moduleKey: 'users' },
            { label: 'Roles & Access', path: '/roles', icon: <SecurityIcon />, moduleKey: 'roles' },
            { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
        ],
    },
];



const Sidebar: React.FC<SidebarProps> = ({
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
    const restrictedModules = useSelector(selectRestrictedModules);
    const roleLevel = useSelector(selectRoleLevel);
    const institutionName = useSelector(selectInstitutionName);
    const institutionLogoUrl = useSelector(selectInstitutionLogoUrl);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const currentWidth = collapsed ? collapsedWidth : width;

    // Filter out restricted modules (only for non-super-admin users)
    const isSuperAdmin = roleLevel === 0;
    const isAdmin = roleLevel <= 2;  // University admin or admin level

    // Core admin modules that are always visible to admins (not restrictable by super admin)
    const coreAdminModules = ['roles', 'users'];

    const filteredNavSections = navSections
        .map(section => ({
            ...section,
            items: section.items.filter(item => {
                // Super admin sees everything
                if (isSuperAdmin) return true;

                // Core admin modules are always visible to admins
                if (item.moduleKey && coreAdminModules.includes(item.moduleKey) && isAdmin) {
                    return true;
                }

                // Hide items that have a restricted moduleKey
                if (item.moduleKey && restrictedModules.includes(item.moduleKey)) {
                    return false;
                }
                return true;
            })
        }))
        .filter(section => section.items.length > 0);  // Remove empty sections


    const handleNavigate = (path: string) => {
        navigate(path);
        if (isMobile) {
            onClose();
        }
    };


    const drawerContent = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                py: 2,
            }}
        >
            {/* Logo */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: 2.5,
                    mb: 3,
                }}
            >
                {institutionLogoUrl ? (
                    <Box
                        component="img"
                        src={(() => {
                            if (institutionLogoUrl.startsWith('http')) return institutionLogoUrl;
                            try {
                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
                                const url = new URL(apiUrl);
                                return `${url.origin}${institutionLogoUrl.startsWith('/') ? '' : '/'}${institutionLogoUrl}`;
                            } catch (e) {
                                return institutionLogoUrl;
                            }
                        })()}
                        alt="Logo"
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            objectFit: 'cover', // Changed to cover to fill the circle better, if it cuts off crucial parts user can revert to contain
                            mr: collapsed ? 0 : 1.5,
                            bgcolor: 'background.paper', // Ensure transparent logos have background
                        }}
                    />
                ) : (
                    <Avatar
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            background: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            mr: collapsed ? 0 : 1.5,
                        }}
                    >
                        {institutionName
                            ? institutionName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            : 'ED'
                        }
                    </Avatar>
                )}

                {!collapsed && (
                    <Box>
                        <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                                color: 'text.primary',
                                lineHeight: 1.2,
                                fontSize: '1.1rem',
                            }}
                        >
                            {institutionName || 'EduERP'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            School Management
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Navigation */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
                {filteredNavSections.map((section, sectionIndex) => (
                    <Box key={section.title} sx={{ mb: 1.5 }}>

                        {!collapsed && (
                            <Typography
                                variant="caption"
                                sx={{
                                    px: 1.5,
                                    py: 0.75,
                                    color: 'text.secondary',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    fontSize: '0.65rem',
                                    display: 'block',
                                }}
                            >
                                {section.title}
                            </Typography>
                        )}
                        <List sx={{ py: 0 }}>
                            {section.items.map((item) => {
                                const isActive = location.pathname === item.path ||
                                    location.pathname.startsWith(item.path + '/');

                                return (
                                    <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
                                        <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                                            <ListItemButton
                                                onClick={() => handleNavigate(item.path)}
                                                selected={isActive}
                                                sx={{
                                                    minHeight: 44,
                                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                                    px: 1.5,
                                                }}
                                            >
                                                <ListItemIcon
                                                    sx={{
                                                        minWidth: collapsed ? 0 : 36,
                                                        color: isActive ? 'primary.main' : 'text.secondary',
                                                        justifyContent: 'center',
                                                        '& svg': { fontSize: 20 },
                                                    }}
                                                >
                                                    {item.icon}
                                                </ListItemIcon>
                                                {!collapsed && (
                                                    <>
                                                        <ListItemText
                                                            primary={item.label}
                                                            primaryTypographyProps={{
                                                                fontSize: '0.875rem',
                                                                fontWeight: isActive ? 600 : 500,
                                                            }}
                                                        />
                                                        {item.badge && (
                                                            <Chip
                                                                label={item.badge}
                                                                size="small"
                                                                color={item.badgeColor || 'primary'}
                                                                sx={{
                                                                    height: 20,
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 600,
                                                                    '& .MuiChip-label': { px: 1 },
                                                                }}
                                                            />
                                                        )}
                                                    </>
                                                )}
                                            </ListItemButton>
                                        </Tooltip>
                                    </ListItem>
                                );
                            })}
                        </List>
                        {sectionIndex < filteredNavSections.length - 1 && !collapsed && (

                            <Divider sx={{ my: 1, mx: 1.5 }} />
                        )}
                    </Box>
                ))}
            </Box>

            {/* User Profile Card */}
            <Box sx={{ px: 1.5, pt: 2, borderTop: 1, borderColor: 'divider', mt: 1 }}>
                <Box
                    sx={{
                        p: collapsed ? 1 : 1.5,
                        borderRadius: 2,
                        backgroundColor: isDark
                            ? 'rgba(129, 140, 248, 0.08)'
                            : 'rgba(79, 70, 229, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                >
                    <Avatar
                        src={user?.avatar_url}
                        alt={user?.first_name}
                        sx={{
                            width: 36,
                            height: 36,
                            fontSize: '0.875rem',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                        }}
                    >
                        {user?.first_name?.[0]}
                    </Avatar>
                    {!collapsed && (
                        <Box sx={{ overflow: 'hidden', flex: 1 }}>
                            <Typography variant="body2" fontWeight="600" noWrap>
                                {user?.full_name || user?.first_name || 'User'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                Administrator
                            </Typography>
                        </Box>
                    )}
                </Box>
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
                sx={{
                    '& .MuiDrawer-paper': {
                        width: width,
                        boxSizing: 'border-box',
                    },
                }}
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

export default Sidebar;
