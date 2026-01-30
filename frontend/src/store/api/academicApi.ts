import { apiSlice } from './apiSlice';
import { SchoolClass } from '../../types';

export const academicApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getClasses: builder.query<SchoolClass[], void>({
            query: () => '/academic/classes',
            providesTags: ['Academic'],
        }),
        getClass: builder.query<SchoolClass, string>({
            query: (id) => `/academic/classes/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Academic', id }],
        }),
        createClass: builder.mutation<SchoolClass, Partial<SchoolClass>>({
            query: (data) => ({
                url: '/academic/classes',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        updateClass: builder.mutation<SchoolClass, { id: string; data: Partial<SchoolClass> }>({
            query: ({ id, data }) => ({
                url: `/academic/classes/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Academic'],
        }),
        deleteClass: builder.mutation<void, string>({
            query: (id) => ({
                url: `/academic/classes/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Academic'],
        }),
    }),
});

export const {
    useGetClassesQuery,
    useGetClassQuery,
    useCreateClassMutation,
    useUpdateClassMutation,
    useDeleteClassMutation,
} = academicApi;
