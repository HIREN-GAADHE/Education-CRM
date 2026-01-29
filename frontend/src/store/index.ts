import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from './slices/authSlice';
import tenantReducer from './slices/tenantSlice';
import uiReducer from './slices/uiSlice';
import { apiSlice } from './api/apiSlice';

// Import all API modules to register their endpoints with apiSlice
// These are side-effect imports that register endpoints via injectEndpoints
import './api/authApi';
import './api/studentApi';
import './api/userApi';
import './api/feeApi';
import './api/roleApi';
import './api/staffApi';
import './api/calendarApi';
import './api/attendanceApi';
import './api/messageApi';
import './api/reportApi';
import './api/dashboardApi';
import './api/courseApi';
import './api/timetableApi';
import './api/examinationApi';
import './api/settingsApi';
import './api/superAdminApi';
import './api/academicApi';
import './api/paymentApi';
import './api/portalApi';
import './api/transportApi';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        tenant: tenantReducer,
        ui: uiReducer,
        // Single centralized apiSlice handles ALL endpoints
        [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
            },
        }).concat(
            // Single middleware handles all injected endpoints
            apiSlice.middleware,
        ),
    devTools: import.meta.env.DEV,
});

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

// Infer types from store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
