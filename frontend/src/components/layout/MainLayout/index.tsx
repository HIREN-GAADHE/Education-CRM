import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Header from './Header';
import { selectSidebarCollapsed, setSidebarCollapsed } from '@/store/slices/uiSlice';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 72;

const MainLayout: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const sidebarCollapsed = useSelector(selectSidebarCollapsed);

    const handleToggleSidebar = () => {
        if (isMobile) {
            setSidebarOpen(!sidebarOpen);
        } else {
            dispatch(setSidebarCollapsed(!sidebarCollapsed));
        }
    };

    const handleCloseSidebar = () => {
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <Sidebar
                open={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={handleCloseSidebar}
                width={SIDEBAR_WIDTH}
                collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
                isMobile={isMobile}
            />

            {/* Main content area */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    width: 0, // Important for flex to work correctly
                }}
            >
                {/* Header */}
                <Header
                    onToggleSidebar={handleToggleSidebar}
                />

                {/* Page content */}
                <Box
                    component="div"
                    sx={{
                        flexGrow: 1,
                        p: 3,
                        overflowX: 'hidden',
                    }}
                >
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
};

export default MainLayout;
