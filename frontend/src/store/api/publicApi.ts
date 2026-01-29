import { apiSlice } from './apiSlice';

export interface PublicTenantInfo {
    name: string;
    slug: string;
    logo_url?: string;
    favicon_url?: string;
    primary_color?: string;
    secondary_color?: string;
}

export const publicApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getPublicTenantInfo: builder.query<PublicTenantInfo, { slug?: string; domain?: string }>({
            query: (params) => {
                if (params.domain) return `/tenants/public-info?domain=${params.domain}`;
                return `/tenants/public-info?slug=${params.slug}`;
            },
            providesTags: ['PublicTenant' as any],
        }),
    }),
});

export const {
    useGetPublicTenantInfoQuery,
    useLazyGetPublicTenantInfoQuery,
} = publicApiSlice;
