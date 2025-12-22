import { createClient } from '@supabase/supabase-js';

// Admin Supabase Client (for authentication and admin data)
const adminSupabaseUrl = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!;
const adminSupabaseAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;

export const adminSupabase = createClient(adminSupabaseUrl, adminSupabaseAnonKey);

// Admin Supabase with Service Role (for server-side operations)
export const createAdminServiceClient = () => {
    const serviceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(adminSupabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

// Frontend Supabase Client (Read-only for user data)
export const createFrontendServiceClient = () => {
    const frontendUrl = process.env.FRONTEND_SUPABASE_URL!;
    const frontendServiceKey = process.env.FRONTEND_SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(frontendUrl, frontendServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
