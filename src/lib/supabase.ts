import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized admin client for client-side authentication
let _adminSupabase: SupabaseClient | null = null;

export const getAdminSupabase = (): SupabaseClient => {
    if (_adminSupabase) return _adminSupabase;

    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY || '';

    // Only create client if we have the required values
    if (url && anonKey) {
        _adminSupabase = createClient(url, anonKey);
        return _adminSupabase;
    }

    // Return a dummy client that won't crash during SSR/build
    // This will be replaced with real client once env vars are available
    console.warn('Supabase not initialized: Missing NEXT_PUBLIC_ADMIN_SUPABASE_URL or NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY');

    // Create with placeholder to prevent crashes - will fail gracefully on actual API calls
    _adminSupabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
    return _adminSupabase;
};

// Direct export for backward compatibility
export const adminSupabase = {
    get auth() {
        return getAdminSupabase().auth;
    },
    from(table: string) {
        return getAdminSupabase().from(table);
    },
    storage: {
        from(bucket: string) {
            return getAdminSupabase().storage.from(bucket);
        }
    },
    rpc(fn: string, params?: any) {
        return getAdminSupabase().rpc(fn, params);
    }
};

// Server-side only clients - these functions should only be called from API routes or server components
export const getAdminServiceClient = () => {
    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL;
    const serviceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        console.error('Admin Supabase credentials not configured');
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
        console.error('Frontend Supabase credentials not configured');
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
