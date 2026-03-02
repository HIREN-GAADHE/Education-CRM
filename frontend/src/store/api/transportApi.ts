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
    vehicle_number?: string;
    vehicle_type?: string;
    driver_id?: string;
    driver_name?: string;
    conductor_id?: string;
    conductor_name?: string;
    pickup_start_time?: string;
    pickup_end_time?: string;
    drop_start_time?: string;
    drop_end_time?: string;
    total_distance_km?: number;
    estimated_duration_minutes?: number;
    monthly_fee?: number;
    status: string;
    stops: RouteStop[];
    student_count: number;
}

export interface StudentTransport {
    id: string;
    student_id: string;
    student_name?: string;
    student_class?: string;
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
            providesTags: ['Transport'],
        }),
        createVehicle: builder.mutation<Vehicle, Partial<Vehicle>>({
            query: (body) => ({
                url: '/transport/vehicles',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Transport'],
        }),
        deleteVehicle: builder.mutation<void, string>({
            query: (id) => ({
                url: `/transport/vehicles/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Transport'],
        }),
        updateVehicle: builder.mutation<Vehicle, { id: string; data: Partial<Vehicle> }>({
            query: ({ id, data }) => ({
                url: `/transport/vehicles/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Transport'],
        }),
        updateVehicleStatus: builder.mutation<Vehicle, { id: string; status: string }>({
            query: ({ id, status }) => ({
                url: `/transport/vehicles/${id}/status`,
                method: 'PATCH',
                body: { status },
            }),
            invalidatesTags: ['Transport'],
        }),

        // Routes
        getRoutes: builder.query<{ items: TransportRoute[]; total: number }, { page?: number; pageSize?: number; status?: string }>({
            query: ({ page = 1, pageSize = 50, status }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (status) params.append('status', status);
                return `/transport/routes?${params.toString()}`;
            },
            providesTags: ['Transport'],
        }),
        createRoute: builder.mutation<TransportRoute, Partial<TransportRoute> & { stops?: Partial<RouteStop>[] }>({
            query: (body) => ({
                url: '/transport/routes',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Transport'],
        }),
        updateRoute: builder.mutation<TransportRoute, { id: string; data: Partial<TransportRoute> }>({
            query: ({ id, data }) => ({
                url: `/transport/routes/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Transport'],
        }),
        deleteRoute: builder.mutation<void, string>({
            query: (id) => ({
                url: `/transport/routes/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Transport'],
        }),
        updateRouteStatus: builder.mutation<{ id: string; status: string }, { id: string; status: string }>({
            query: ({ id, status }) => ({
                url: `/transport/routes/${id}/status`,
                method: 'PATCH',
                body: { status },
            }),
            invalidatesTags: ['Transport'],
        }),

        // Stops
        addRouteStop: builder.mutation<RouteStop, { routeId: string; stop: Partial<RouteStop> }>({
            query: ({ routeId, stop }) => ({
                url: `/transport/routes/${routeId}/stops`,
                method: 'POST',
                body: stop,
            }),
            invalidatesTags: ['Transport'],
        }),
        updateRouteStop: builder.mutation<RouteStop, { routeId: string; stopId: string; data: Partial<RouteStop> }>({
            query: ({ routeId, stopId, data }) => ({
                url: `/transport/routes/${routeId}/stops/${stopId}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Transport'],
        }),
        deleteRouteStop: builder.mutation<void, { routeId: string; stopId: string }>({
            query: ({ routeId, stopId }) => ({
                url: `/transport/routes/${routeId}/stops/${stopId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Transport'],
        }),

        // Student Assignments
        getAssignments: builder.query<{ items: StudentTransport[]; total: number }, { page?: number; pageSize?: number; routeId?: string; activeOnly?: boolean }>({
            query: ({ page = 1, pageSize = 50, routeId, activeOnly = true }) => {
                const params = new URLSearchParams();
                params.append('page', page.toString());
                params.append('page_size', pageSize.toString());
                if (routeId) params.append('route_id', routeId);
                params.append('active_only', activeOnly.toString());
                return `/transport/assignments?${params.toString()}`;
            },
            providesTags: ['Transport'],
        }),
        assignStudent: builder.mutation<StudentTransport, { student_id: string; route_id: string; stop_id?: string; trip_type?: string; monthly_fee?: number }>({
            query: (body) => ({
                url: '/transport/assignments',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Transport'],
        }),
        removeAssignment: builder.mutation<void, string>({
            query: (id) => ({
                url: `/transport/assignments/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Transport'],
        }),

        // Stats
        getTransportStats: builder.query<TransportStats, void>({
            query: () => '/transport/stats',
            providesTags: ['Transport'],
        }),
    }),
});

export const {
    useGetVehiclesQuery,
    useCreateVehicleMutation,
    useDeleteVehicleMutation,
    useUpdateVehicleMutation,
    useUpdateVehicleStatusMutation,
    useGetRoutesQuery,
    useCreateRouteMutation,
    useUpdateRouteMutation,
    useDeleteRouteMutation,
    useUpdateRouteStatusMutation,
    useAddRouteStopMutation,
    useUpdateRouteStopMutation,
    useDeleteRouteStopMutation,
    useGetAssignmentsQuery,
    useAssignStudentMutation,
    useRemoveAssignmentMutation,
    useGetTransportStatsQuery,
} = transportApi;
