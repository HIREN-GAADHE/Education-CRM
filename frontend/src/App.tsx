import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { selectRoleLevel } from './store/slices/authSlice';

import { selectTheme, selectPrimaryColor } from './store/slices/uiSlice';
import { useTenantBranding } from './hooks/useTenantBranding';

// Theme
import { createDynamicTheme } from './config/theme';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';
import SuperAdminLayout from './components/layout/SuperAdminLayout';

// Auth guards
import { ProtectedRoute, PublicRoute } from './core/auth';

// Pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminStatsPage from './pages/SuperAdminStatsPage';
import SuperAdminSettingsPage from './pages/SuperAdminSettingsPage';
import SuperAdminLogsPage from './pages/SuperAdminLogsPage';
import TenantDetailsPage from './pages/TenantDetailsPage';
import UsersPage from './pages/Users';
import RolesPage from './pages/Roles';
import SettingsPage from './pages/Settings';
import ProfilePage from './pages/Profile';
import StudentsPage from './pages/Students';
import StudentDetailsPage from './pages/StudentDetails';
import CoursesPage from './pages/Courses';
import FeesPage from './pages/Fees';
import AttendancePage from './pages/Attendance';
import StaffPage from './pages/Staff';
import CalendarPage from './pages/Calendar';
import ReportsPage from './pages/Reports';
import CommunicationPage from './pages/Communication';
import TimetablePage from './pages/Timetable';
import ExaminationsPage from './pages/Examinations';
import PaymentsPage from './pages/Payments';

import LearningHub from './pages/Learning/LearningHub';
import LearningPlayer from './pages/Learning/LearningPlayer';
import LearningModuleManage from './pages/Learning/LearningModuleManage';

import ParentDashboard from './pages/ParentDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TransportPage from './pages/Transport';
import MarketplacePage from './pages/Marketplace';
import ClassesPage from './pages/Classes'; // Added
import PTMScheduling from './pages/PTM/PTMScheduling';
import HealthRecords from './pages/HealthRecords/HealthRecords';
import DailyDiaryPage from './pages/DailyDiary/DailyDiary';
import PayrollPage from './pages/Payroll/Payroll';
import ForbiddenPage from './pages/Forbidden';
import NotFoundPage from './pages/NotFound';

// Root Layout switcher
const RootLayout: React.FC = () => {
    const roleLevel = useSelector(selectRoleLevel);
    // Level 0 = Super Admin
    if (roleLevel === 0) {
        return <SuperAdminLayout />;
    }
    // All other users (Tenants)
    return <MainLayout />;
}

// Dashboard router logic
const DashboardRouter: React.FC = () => {
    const roleLevel = useSelector(selectRoleLevel);
    if (roleLevel === 0) {
        return <SuperAdminDashboard />;
    }
    return <DashboardPage />;
};

// Settings router logic - routes to correct settings page based on role
const SettingsRouter: React.FC = () => {
    const roleLevel = useSelector(selectRoleLevel);
    if (roleLevel === 0) {
        return <SuperAdminSettingsPage />;
    }
    return <SettingsPage />;
};

const App: React.FC = () => {
    const themeMode = useSelector(selectTheme);
    const primaryColor = useSelector(selectPrimaryColor);

    // Apply tenant branding
    useTenantBranding();

    const theme = useMemo(() => {
        return createDynamicTheme(themeMode, primaryColor);
    }, [themeMode, primaryColor]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <AuthLayout>
                                <LoginPage />
                            </AuthLayout>
                        </PublicRoute>
                    }
                />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <RootLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<Navigate to="/dashboard" replace />} />

                    {/* Dashboard Route */}
                    <Route path="dashboard" element={<DashboardRouter />} />

                    {/* Super Admin specific routes */}
                    <Route path="tenants" element={<SuperAdminDashboard />} />
                    <Route path="tenants/:id" element={<TenantDetailsPage />} />
                    <Route path="stats" element={<SuperAdminStatsPage />} />
                    <Route path="logs" element={<SuperAdminLogsPage />} />

                    {/* Shared routes with role-based content */}
                    <Route path="settings" element={<SettingsRouter />} />

                    {/* Tenant Pages */}
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="roles" element={<RolesPage />} />
                    <Route path="students" element={<StudentsPage />} />
                    <Route path="students/:id" element={<StudentDetailsPage />} />
                    <Route path="classes" element={<ClassesPage />} /> {/* Added */}
                    <Route path="courses" element={<CoursesPage />} />
                    <Route path="learning" element={<LearningHub />} />
                    <Route path="learning/:id" element={<LearningPlayer />} />
                    <Route path="learning/:id/manage" element={<LearningModuleManage />} />
                    <Route path="fees" element={<FeesPage />} />
                    <Route path="attendance" element={<AttendancePage />} />
                    <Route path="staff" element={<StaffPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="communication" element={<CommunicationPage />} />

                    {/* New Module Routes */}
                    <Route path="timetable" element={<TimetablePage />} />
                    <Route path="examinations" element={<ExaminationsPage />} />
                    <Route path="payments" element={<PaymentsPage />} />


                    {/* Parent & Student Portal Routes */}
                    <Route path="parent-portal" element={<ParentDashboard />} />
                    <Route path="student-portal" element={<StudentDashboard />} />

                    {/* Additional Modules */}
                    <Route path="transport" element={<TransportPage />} />
                    <Route path="marketplace" element={<MarketplacePage />} />
                    <Route path="ptm" element={<PTMScheduling />} />
                    <Route path="health-records" element={<HealthRecords />} />
                    <Route path="daily-diary" element={<DailyDiaryPage />} />
                    <Route path="payroll" element={<PayrollPage />} />

                    <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* Error pages */}
                <Route path="/forbidden" element={<ForbiddenPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </ThemeProvider>
    );
};

export default App;

