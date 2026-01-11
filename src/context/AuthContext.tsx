'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminSupabase, isSessionExpired, updateLastActivity, clearSessionData } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AdminUser {
    id: string;
    email: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
    role: string;
    is_active: boolean;
}

interface AuthContextType {
    user: User | null;
    adminUser: AdminUser | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    refreshAdminUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session check interval (every minute)
const SESSION_CHECK_INTERVAL = 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Use refs to avoid stale closures
    const userRef = useRef<User | null>(null);

    // Keep userRef in sync with user state
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const fetchAdminUser = async (userId: string): Promise<AdminUser | null> => {
        try {
            const { data, error } = await adminSupabase
                .from('admin_users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching admin user:', error);
                return null;
            }
            return data as AdminUser;
        } catch (err) {
            console.error('Error in fetchAdminUser:', err);
            return null;
        }
    };

    const refreshAdminUser = async () => {
        if (user?.id) {
            const adminData = await fetchAdminUser(user.id);
            setAdminUser(adminData);
        }
    };

    // Sign out function - uses ref to get current user value
    const signOut = async (): Promise<void> => {
        try {
            const currentUser = userRef.current;

            // Log the logout activity before signing out
            if (currentUser) {
                try {
                    await adminSupabase.from('activity_logs').insert({
                        admin_id: currentUser.id,
                        admin_email: currentUser.email,
                        action_type: 'logout',
                        action_description: 'Admin logged out',
                    });
                } catch (logError) {
                    console.error('Error logging logout:', logError);
                }
            }

            // Sign out from Supabase
            await adminSupabase.auth.signOut();

            // Clear all session data
            clearSessionData();

            // Clear state
            setUser(null);
            setAdminUser(null);
            setSession(null);

            // Redirect to login
            router.push('/login');

            toast.success('Signed out successfully');
        } catch (error) {
            console.error('Error signing out:', error);
            toast.error('Error signing out. Please try again.');
        }
    };

    // Handle session timeout
    const handleSessionTimeout = async () => {
        const currentUser = userRef.current;

        toast.error('Session expired due to inactivity. Please login again.', {
            duration: 5000,
        });

        // Log timeout
        if (currentUser) {
            try {
                await adminSupabase.from('activity_logs').insert({
                    admin_id: currentUser.id,
                    admin_email: currentUser.email,
                    action_type: 'session_timeout',
                    action_description: 'Session expired due to 30 minutes of inactivity',
                });
            } catch (logError) {
                console.error('Error logging timeout:', logError);
            }
        }

        // Sign out
        await adminSupabase.auth.signOut();
        clearSessionData();
        setUser(null);
        setAdminUser(null);
        setSession(null);
        router.push('/login');
    };

    // Check session validity periodically
    useEffect(() => {
        if (!user || pathname === '/login') return;

        const checkSession = () => {
            if (isSessionExpired()) {
                handleSessionTimeout();
            }
        };

        // Check immediately
        checkSession();

        // Set up interval to check periodically
        const intervalId = setInterval(checkSession, SESSION_CHECK_INTERVAL);

        return () => clearInterval(intervalId);
    }, [user, pathname]);

    // Track user activity (mouse movement, keyboard, clicks)
    useEffect(() => {
        if (!user || pathname === '/login') return;

        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

        const handleActivity = () => {
            updateLastActivity();
        };

        // Add event listeners
        activityEvents.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [user, pathname]);

    // Initialize auth state with timeout
    useEffect(() => {
        let mounted = true;
        let timeoutId: NodeJS.Timeout;

        const initAuth = async () => {
            try {
                // Set a timeout to prevent infinite loading
                timeoutId = setTimeout(() => {
                    if (mounted && loading) {
                        console.warn('Auth initialization timeout - forcing load complete');
                        setLoading(false);
                    }
                }, 5000);

                // Check if session expired before even trying to get it
                if (isSessionExpired()) {
                    clearSessionData();
                    if (mounted) {
                        setLoading(false);
                    }
                    return;
                }

                const { data: { session: currentSession } } = await adminSupabase.auth.getSession();

                if (!mounted) return;

                if (currentSession?.user) {
                    // Update activity timestamp on successful session restore
                    updateLastActivity();

                    setSession(currentSession);
                    setUser(currentSession.user);

                    const adminData = await fetchAdminUser(currentSession.user.id);
                    if (mounted) {
                        setAdminUser(adminData);
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                if (mounted) {
                    clearTimeout(timeoutId);
                    setLoading(false);
                }
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = adminSupabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted) return;

            setSession(newSession);
            setUser(newSession?.user ?? null);

            if (newSession?.user) {
                updateLastActivity();
                const adminData = await fetchAdminUser(newSession.user.id);
                if (mounted) {
                    setAdminUser(adminData);
                }
            } else {
                setAdminUser(null);
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await adminSupabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                // Check if user exists in admin_users table
                const adminData = await fetchAdminUser(data.user.id);
                if (!adminData) {
                    await adminSupabase.auth.signOut();
                    clearSessionData();
                    throw new Error('You are not authorized as an admin');
                }

                if (!adminData.is_active) {
                    await adminSupabase.auth.signOut();
                    clearSessionData();
                    throw new Error('Your admin account has been deactivated');
                }

                // Set initial activity timestamp
                updateLastActivity();
                setAdminUser(adminData);

                // Log the login activity (fire and forget)
                adminSupabase.from('activity_logs').insert({
                    admin_id: data.user.id,
                    admin_email: email,
                    action_type: 'login',
                    action_description: 'Admin logged in',
                }).then(() => { });
            }

            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    };

    return (
        <AuthContext.Provider value={{ user, adminUser, session, loading, signIn, signOut, refreshAdminUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
