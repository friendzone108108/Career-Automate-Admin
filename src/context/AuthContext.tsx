'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminSupabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchAdminUser = async (userId: string) => {
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
    };

    const refreshAdminUser = async () => {
        if (user?.id) {
            const adminData = await fetchAdminUser(user.id);
            setAdminUser(adminData);
        }
    };

    useEffect(() => {
        // Get initial session
        adminSupabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const adminData = await fetchAdminUser(session.user.id);
                if (adminData) {
                    setAdminUser(adminData);
                    // Update last login
                    await adminSupabase
                        .from('admin_users')
                        .update({ last_login: new Date().toISOString() })
                        .eq('id', session.user.id);
                } else {
                    // User exists in auth but not in admin_users - sign out
                    await adminSupabase.auth.signOut();
                    setUser(null);
                    setSession(null);
                }
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = adminSupabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const adminData = await fetchAdminUser(session.user.id);
                setAdminUser(adminData);
            } else {
                setAdminUser(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
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
                    throw new Error('You are not authorized as an admin');
                }

                if (!adminData.is_active) {
                    await adminSupabase.auth.signOut();
                    throw new Error('Your admin account has been deactivated');
                }

                setAdminUser(adminData);

                // Log the login activity
                await adminSupabase.from('activity_logs').insert({
                    admin_id: data.user.id,
                    admin_email: email,
                    action_type: 'login',
                    action_description: 'Admin logged in',
                });
            }

            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const signOut = async () => {
        if (user) {
            // Log the logout activity
            await adminSupabase.from('activity_logs').insert({
                admin_id: user.id,
                admin_email: user.email,
                action_type: 'logout',
                action_description: 'Admin logged out',
            });
        }

        await adminSupabase.auth.signOut();
        setUser(null);
        setAdminUser(null);
        setSession(null);
        router.push('/login');
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
