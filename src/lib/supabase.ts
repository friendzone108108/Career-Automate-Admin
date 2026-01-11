import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Session timeout in milliseconds (30 minutes)
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Custom storage that uses sessionStorage (clears when browser closes)
const sessionStorageAdapter = {
    getItem: (key: string): string | null => {
        if (typeof window === 'undefined') return null;

        const item = sessionStorage.getItem(key);
        if (!item) return null;

        // Check if session has expired
        const lastActivity = sessionStorage.getItem('admin_last_activity');
        if (lastActivity) {
            const elapsed = Date.now() - parseInt(lastActivity, 10);
            if (elapsed > SESSION_TIMEOUT_MS) {
                // Session expired - clear everything
                sessionStorage.removeItem(key);
                sessionStorage.removeItem('admin_last_activity');
                return null;
            }
        }

        return item;
    },
    setItem: (key: string, value: string): void => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(key, value);
        // Update last activity timestamp
        sessionStorage.setItem('admin_last_activity', Date.now().toString());
    },
    removeItem: (key: string): void => {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(key);
    },
};

// Lazy-initialized admin client for client-side authentication
let _adminSupabase: SupabaseClient | null = null;

export const getAdminSupabase = (): SupabaseClient => {
    if (_adminSupabase) return _adminSupabase;

    const url = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY || '';

    // Only create client if we have the required values
    if (url && anonKey) {
        _adminSupabase = createClient(url, anonKey, {
            auth: {
                storage: sessionStorageAdapter,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            }
        });
        return _adminSupabase;
    }

    // Return a dummy client that won't crash during SSR/build
    console.warn('Supabase not initialized: Missing NEXT_PUBLIC_ADMIN_SUPABASE_URL or NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY');

    // Create with placeholder to prevent crashes - will fail gracefully on actual API calls
    _adminSupabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: {
            storage: sessionStorageAdapter,
            autoRefreshToken: false,
            persistSession: false,
        }
    });
    return _adminSupabase;
};

// Update last activity timestamp (call this on user interactions)
export const updateLastActivity = (): void => {
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('admin_last_activity', Date.now().toString());
    }
};

// Check if session is expired
export const isSessionExpired = (): boolean => {
    if (typeof window === 'undefined') return false;

    const lastActivity = sessionStorage.getItem('admin_last_activity');
    if (!lastActivity) return true;

    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed > SESSION_TIMEOUT_MS;
};

// Clear all session data
export const clearSessionData = (): void => {
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('admin_last_activity');
        // Clear all supabase-related items
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('sb-')) {
                sessionStorage.removeItem(key);
            }
        });
    }
};

// Direct export for backward compatibility
export const adminSupabase = {
    get auth() {
        return getAdminSupabase().auth;
    },
    from(table: string) {
        updateLastActivity();
        return getAdminSupabase().from(table);
    },
    storage: {
        from(bucket: string) {
            updateLastActivity();
            return getAdminSupabase().storage.from(bucket);
        }
    },
    rpc(fn: string, params?: any) {
        updateLastActivity();
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
