'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);

    useEffect(() => {
        if (!loading && !user && pathname !== '/login') {
            router.push('/login');
        }
    }, [user, loading, router, pathname]);

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
