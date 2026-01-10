import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized admin client for client-side authentication
let _adminSupabase: SupabaseClient | null = null;

export const getAdminSupabase = () => {
    if (_adminSupabase) return _adminSupabase;

    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        throw new Error('Admin Supabase URL and Anon Key are required');
    }

    _adminSupabase = createClient(url, anonKey);
    return _adminSupabase;
};

// For backward compatibility - creates client on first access
export const adminSupabase = new Proxy({} as SupabaseClient, {
    get(_, prop) {
        const client = getAdminSupabase();
        const value = (client as any)[prop];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});

// Server-side only clients - these functions should only be called from API routes or server components
export const getAdminServiceClient = () => {
    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL;
    const serviceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error('Admin Supabase credentials not configured');
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

export const getFrontendServiceClient = () => {
    const url = process.env.FRONTEND_SUPABASE_URL;
    const serviceRoleKey = process.env.FRONTEND_SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error('Frontend Supabase credentials not configured');
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

// Legacy exports for compatibility
export const createAdminServiceClient = getAdminServiceClient;
export const createFrontendServiceClient = getFrontendServiceClient;
