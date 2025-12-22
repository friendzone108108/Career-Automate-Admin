import { createClient } from '@supabase/supabase-js';

// Admin Supabase Client (for client-side authentication)
const adminSupabaseUrl = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!;
const adminSupabaseAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;

export const adminSupabase = createClient(adminSupabaseUrl, adminSupabaseAnonKey);

// Server-side only clients - these functions should only be called from API routes or server components
export const getAdminServiceClient = () => {
    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!;
    const serviceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY!;

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
    const url = process.env.FRONTEND_SUPABASE_URL!;
    const serviceRoleKey = process.env.FRONTEND_SUPABASE_SERVICE_ROLE_KEY!;

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

// Legacy exports for compatibility (will throw error if used client-side without proper env vars)
export const createAdminServiceClient = getAdminServiceClient;
export const createFrontendServiceClient = getFrontendServiceClient;
