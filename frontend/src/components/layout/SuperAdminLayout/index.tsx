import React, { useState } from 'react';
import { Box, useTheme, useMediaQuery, IconButton, AppBar, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from './Sidebar';

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 70;

const SuperAdminLayout: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const handleToggleSidebar = () => {
        if (isMobile) {
            setSidebarOpen(!sidebarOpen);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
            <SuperAdminSidebar
                open={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                width={SIDEBAR_WIDTH}
                collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
                isMobile={isMobile}
            />

            <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: 0 }}>
                {/* Minimal Header */}
                <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #eee' }}>
                    <Toolbar>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleToggleSidebar}
                            sx={{ mr: 2 }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, color: '#333' }}>
                            Platform Administration
                        </Typography>
                    </Toolbar>
                </AppBar>

                {/* Content */}
                <Box component="div" sx={{ flexGrow: 1, p: 3, overflowX: 'hidden' }}>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
};

export default SuperAdminLayout;
