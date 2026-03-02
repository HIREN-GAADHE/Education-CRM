import React, { useState } from 'react';
import {
    Box, useTheme, useMediaQuery, IconButton, Typography, Avatar
} from '@mui/material';
import { MenuRounded as MenuIcon, NotificationsRounded as NotifIcon } from '@mui/icons-material';
import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from './Sidebar';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 88;

const SuperAdminLayout: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const handleToggleSidebar = () => {
        if (isMobile) setSidebarOpen(!sidebarOpen);
        else setSidebarCollapsed(!sidebarCollapsed);
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#e2e8f0' }}>
            <SuperAdminSidebar
                open={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                width={SIDEBAR_WIDTH}
                collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
                isMobile={isMobile}
            />

            <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: 0, position: 'relative' }}>
                {/* ── Top Bar ─────────────────────────────────────── */}
                <Box sx={{
                    position: 'sticky', top: 16, zIndex: 10,
                    mx: { xs: 2, md: 4 }, mb: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: { xs: 2, md: 4 }, py: 1.5,
                    bgcolor: '#f8fafc',
                    borderRadius: '24px',
                    boxShadow: '10px 10px 20px #c1c8d1, -10px -10px 20px #ffffff, inset 0 2px 0 rgba(255,255,255,0.8)',
                    border: '1px solid #ffffff',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton
                            onClick={handleToggleSidebar}
                            sx={{
                                color: '#4f46e5',
                                bgcolor: '#f1f5f9',
                                boxShadow: '5px 5px 10px #d9dce1, -5px -5px 10px #ffffff',
                                borderRadius: '12px',
                                '&:hover': { bgcolor: '#e2e8f0' }
                            }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', lineHeight: 1.2 }}>
                                Good Morning, Admin
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                                Complete platform overview.
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IconButton sx={{
                            color: '#ea580c',
                            bgcolor: '#f1f5f9',
                            boxShadow: '5px 5px 10px #d9dce1, -5px -5px 10px #ffffff',
                            borderRadius: '12px',
                            '&:hover': { bgcolor: '#e2e8f0' }
                        }}>
                            <NotifIcon />
                        </IconButton>
                        <Avatar sx={{
                            width: 48, height: 48,
                            background: 'linear-gradient(145deg, #6366f1, #4f46e5)',
                            color: '#ffffff',
                            fontSize: 16, fontWeight: 900,
                            boxShadow: '0 10px 20px -5px #4f46e5, inset 0 2px 2px rgba(255, 255, 255, 0.4)',
                            border: '3px solid #ffffff',
                            cursor: 'pointer'
                        }}>
                            SA
                        </Avatar>
                    </Box>
                </Box>

                {/* ── Page content ─────────────────────────────────────────── */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', px: { xs: 2, md: 4 }, pb: { xs: 4, md: 8 } }}>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
};

export default SuperAdminLayout;
