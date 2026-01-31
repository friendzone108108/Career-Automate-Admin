import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function validateAdminRequest(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
        return { user: null, error: 'Missing Authorization header' };
    }

    const token = authHeader.replace('Bearer ', '');
    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!;

    // Create a temporary client to validate the token
    const supabase = createClient(url, anonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return { user: null, error: 'Invalid or expired token' };
    }

    // Check if user is in admin_users table
    // We can use the service client for this check to be sure we can read the table
    // (assuming admin_users might have RLS)
    const serviceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: adminUser } = await adminClient
        .from('admin_users')
        .select('id, is_active')
        .eq('id', user.id)
        .single();

    if (!adminUser || !adminUser.is_active) {
        return { user: null, error: 'User is not an authorized admin' };
    }

    return { user, error: null };
}
