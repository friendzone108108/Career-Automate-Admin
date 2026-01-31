'use client';

import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { isSessionExpired, clearSessionData } from '@/lib/supabase';

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, signOut } = useAuth();
    const pathname = usePathname();
    const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);
    const [isValidSession, setIsValidSession] = useState(true);

    // Force redirect to login
    const forceRedirectToLogin = useCallback(() => {
        clearSessionData();
        window.location.href = '/login';
    }, []);

    // Check session validity on mount and periodically
    useEffect(() => {
        // Initial check
        if (isSessionExpired()) {
            setIsValidSession(false);
            forceRedirectToLogin();
            return;
        }

        // Periodic check every 10 seconds
        const intervalId = setInterval(() => {
            if (isSessionExpired()) {
                setIsValidSession(false);
                forceRedirectToLogin();
            }
        }, 10000);

        return () => clearInterval(intervalId);
    }, [forceRedirectToLogin]);

    // Redirect if no user
    useEffect(() => {
        if (!loading && !user && pathname !== '/login') {
            forceRedirectToLogin();
        }
    }, [user, loading, pathname, forceRedirectToLogin]);

    // Show slow loading message after 2 seconds
    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => {
                setShowSlowLoadingMessage(true);
            }, 2000);
            return () => clearTimeout(timer);
        } else {
            setShowSlowLoadingMessage(false);
        }
    }, [loading]);

    // If session is invalid, show nothing (redirect in progress)
    if (!isValidSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600">Session expired. Redirecting to login...</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600">Loading...</p>
                    {showSlowLoadingMessage && (
                        <p className="text-sm text-gray-400 text-center max-w-xs">
                            Taking longer than expected. Please wait...
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (!user) {
        // Return null while redirect happens
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <Header />
            <main className="ml-64 pt-16 p-6">
                {children}
            </main>
        </div>
    );
}
