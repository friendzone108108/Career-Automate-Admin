'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    Key,
    Bell,
    Settings,
    Cog,
    Briefcase
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/users', label: 'User Management', icon: Users },
    { href: '/job-fetcher', label: 'Job Fetcher', icon: Briefcase },
    { href: '/api-keys', label: 'API Keys', icon: Key },
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/control', label: 'Control Mechanism', icon: Cog },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 shadow-sm">
            <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-16 items-center px-4 border-b border-gray-200">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <img
                            src="https://i.postimg.cc/1RvV7gcX/CA_logo_banner_transparent.png"
                            alt="CareerAutomate Admin"
                            className="h-10 object-contain"
                        />
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 -ml-1 pl-5'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                )}
                            >
                                <Icon className={cn('w-5 h-5', isActive ? 'text-blue-600' : 'text-gray-400')} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}
