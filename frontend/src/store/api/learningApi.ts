import { apiSlice } from './apiSlice';

export interface LearningContent {
    id: string;
    module_id: string;
    title: string;
    description?: string;
    content_type: 'video' | 'document' | 'link';
    content_url: string;
    duration_seconds?: number;
    order: number;
}

export interface LearningModule {
    id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    category?: string;
    is_published: boolean;
    created_at?: string;
    updated_at?: string;
    contents?: LearningContent[];
}

export const learningApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getLearningModules: builder.query<LearningModule[], { search?: string; category?: string } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.search) searchParams.append('search', params.search);
                if (params?.category) searchParams.append('category', params.category);
                return `/learning/modules?${searchParams.toString()}`;
            },
            providesTags: ['Modules'],
        }),
        getLearningModule: builder.query<LearningModule, string>({
            query: (id) => `/learning/modules/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Modules', id }],
        }),
        createLearningModule: builder.mutation<LearningModule, Partial<LearningModule>>({
            query: (data) => ({
                url: '/learning/modules',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Modules'],
        }),
        addLearningContent: builder.mutation<LearningContent, { moduleId: string; data: Partial<LearningContent> }>({
            query: ({ moduleId, data }) => ({
                url: `/learning/modules/${moduleId}/content`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { moduleId }) => [{ type: 'Modules', id: moduleId }],
        }),
        updateLearningContent: builder.mutation<LearningContent, { moduleId: string; contentId: string; data: Partial<LearningContent> }>({
            query: ({ moduleId, contentId, data }) => ({
                url: `/learning/modules/${moduleId}/content/${contentId}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (_result, _error, { moduleId }) => [{ type: 'Modules', id: moduleId }],
        }),
        deleteLearningContent: builder.mutation<void, { moduleId: string; contentId: string }>({
            query: ({ moduleId, contentId }) => ({
                url: `/learning/modules/${moduleId}/content/${contentId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { moduleId }) => [{ type: 'Modules', id: moduleId }],
        }),
    }),
});

export const {
    useGetLearningModulesQuery,
    useGetLearningModuleQuery,
    useCreateLearningModuleMutation,
    useAddLearningContentMutation,
    useUpdateLearningContentMutation,
    useDeleteLearningContentMutation,
} = learningApi;
