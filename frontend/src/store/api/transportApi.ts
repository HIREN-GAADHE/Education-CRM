import { apiSlice } from './apiSlice';

// Types
export interface Vehicle {
    id: string;
    vehicle_number: string;
    vehicle_type: string;
    make?: string;
    model?: string;
    seating_capacity: number;
    status: string;
    gps_enabled: boolean;
    driver_id?: string;
    conductor_id?: string;
}

export interface RouteStop {
    id: string;
    stop_name: string;
    stop_order: number;
    address?: string;
    landmark?: string;
    pickup_time?: string;
    drop_time?: string;
    monthly_fee?: number;
}

export interface TransportRoute {
    id: string;
    route_name: string;
    route_code?: string;
    description?: string;
    vehicle_id?: string;
    monthly_fee?: number;
    status: string;
    stops: RouteStop[];
    student_count: number;
}

export interface StudentTransport {
    id: string;
    student_id: string;
    student_name?: string;
    route_id: string;
    route_name?: string;
    stop_id?: string;
    stop_name?: string;
    trip_type: string;
    monthly_fee?: number;
    is_active: boolean;
}

export interface TransportStats {
    total_vehicles: number;
    active_vehicles: number;
    total_routes: number;
    active_routes: number;
    total_students: number;
    total_stops: number;
}

// Inject endpoints into the centralized apiSlice
export const transportApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Vehicles
        getVehicles: builder.query<{ items: Vehicle[]; total: number }, { page?: number; pageSize?: number; status?: string }>({
            query: ({ page = 1, pageSize = 20, status }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (status) params.append('status', status);
                return `/transport/vehicles?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        createVehicle: builder.mutation<Vehicle, Partial<Vehicle>>({
            query: (body) => ({
                url: '/transport/vehicles',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteVehicle: builder.mutation<void, string>({
            query: (id) => ({
                url: `/transport/vehicles/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),
        updateVehicle: builder.mutation<Vehicle, { id: string; data: Partial<Vehicle> }>({
            query: ({ id, data }) => ({
                url: `/transport/vehicles/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),

        // Routes
        getRoutes: builder.query<{ items: TransportRoute[]; total: number }, { page?: number; pageSize?: number; status?: string }>({
            query: ({ page = 1, pageSize = 20, status }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (status) params.append('status', status);
                return `/transport/routes?${params.toString()}`;
            },
            providesTags: ['Academic'],
        }),
        createRoute: builder.mutation<TransportRoute, { route_name: string; route_code?: string; description?: string; vehicle_id?: string; monthly_fee?: number; stops?: { stop_name: string; stop_order: number }[] }>({
            query: (body) => ({
                url: '/transport/routes',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Academic'],
        }),
        addRouteStop: builder.mutation<RouteStop, { routeId: string; stop: Partial<RouteStop> }>({
            query: ({ routeId, stop }) => ({
                url: `/transport/routes/${routeId}/stops`,
                method: 'POST',
                body: stop,
            }),
            invalidatesTags: ['Academic'],
        }),

        // Student Assignments
        getAssignments: builder.query<{ items: StudentTransport[]; total: number }, { page?: number; pageSize?: number; routeId?: string; activeOnly?: boolean }>({
            query: ({ page = 1, pageSize = 20, routeId, activeOnly = true }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (routeId) params.append('route_id', routeId);
                params.append('active_only', activeOnly.toString());
                return `/transport/assignments?${params.toString()}`;
            },
            providesTags: ['Student'],
        }),
        assignStudent: builder.mutation<StudentTransport, { student_id: string; route_id: string; stop_id?: string; trip_type?: string; monthly_fee?: number }>({
            query: (body) => ({
                url: '/transport/assignments',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Student', 'Academic'],
        }),
        removeAssignment: builder.mutation<void, string>({
            query: (id) => ({
                url: `/transport/assignments/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Student', 'Academic'],
        }),

        // Stats
        getTransportStats: builder.query<TransportStats, void>({
            query: () => '/transport/stats',
            providesTags: ['Academic'],
        }),
    }),
});

export const {
    useGetVehiclesQuery,
    useCreateVehicleMutation,
    useDeleteVehicleMutation,
    useUpdateVehicleMutation,
    useGetRoutesQuery,
    useCreateRouteMutation,
    useAddRouteStopMutation,
    useGetAssignmentsQuery,
    useAssignStudentMutation,
    useRemoveAssignmentMutation,
    useGetTransportStatsQuery,
} = transportApi;
