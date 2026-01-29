import { useEffect } from 'react';
import { useLazyGetPublicTenantInfoQuery } from '../store/api/publicApi';
import { useDispatch } from 'react-redux';
import { setInstitutionDetails, setPrimaryColor } from '../store/slices/uiSlice';

export const useTenantBranding = () => {
    const [trigger, { data, isFetching }] = useLazyGetPublicTenantInfoQuery();
    const dispatch = useDispatch();

    useEffect(() => {
        // Determine slug from URL
        // 1. Check subdomain: tenant.app.com
        // 2. Check query param: app.com/login?slug=tenant
        // 3. Check path? app.com/tenant/login (not supported yet)

        let slug = '';
        let domain = '';
        const host = window.location.host;
        const parts = host.split('.');

        // Detailed Logic:
        // 1. Localhost: localhost:3000 -> parts.length=1. No slug, no domain.
        // 2. Tenant Localhost: tenant.localhost:3000 -> parts.length=2. Slug=tenant.
        // 3. Staging/Prod (app.domain.com) -> Slug=app (system) or Slug=tenant
        // 4. Custom Domain (university.com) -> Domain=university.com

        // Exclude system subdomains
        const systemSubdomains = ['www', 'app', 'admin', 'api'];

        if (host.includes('localhost')) {
            if (parts.length > 1 && !systemSubdomains.includes(parts[0])) {
                slug = parts[0];
            }
        } else {
            // Production Domain Logic
            // Assuming main domain is 'eduerp.com' (hardcoded for now or env var)
            const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || 'eduerp.com';

            if (host.endsWith(mainDomain)) {
                // It is a subdomain of our app
                // tenant.eduerp.com
                const sub = host.replace(`.${mainDomain}`, '');
                if (sub !== host && !systemSubdomains.includes(sub)) {
                    slug = sub;
                }
            } else {
                // It is a custom domain!
                domain = host;
            }
        }

        // Variable override for testing/demo via params
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('slug')) {
            slug = searchParams.get('slug')!;
            domain = ''; // Clear domain if manual slug provided
        }

        if (domain) {
            trigger({ domain });
        } else if (slug) {
            trigger({ slug });
        }
    }, [trigger]);

    useEffect(() => {
        if (data) {
            // Dispatch to UI slice
            dispatch(setInstitutionDetails({
                name: data.name,
                logoUrl: data.logo_url
            }));

            if (data.primary_color) {
                dispatch(setPrimaryColor(data.primary_color));
            }

            // Update Favicon
            // This is a side effect, could be in uiSlice or here
            // const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            // if (link && data.favicon_url) {
            //    link.href = data.favicon_url;
            // } 

            // Update Title
            document.title = `${data.name}`;
        }
    }, [data, dispatch]);

    return { isLoading: isFetching };
};
