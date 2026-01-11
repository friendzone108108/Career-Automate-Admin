'use client';

import { useAuth } from '@/context/AuthContext';
import { Bell, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

export function Header() {
    const { adminUser, signOut } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="fixed top-0 right-0 left-64 z-30 h-16 bg-white border-b border-gray-200 px-6">
            <div className="flex h-full items-center justify-end gap-4">
                {/* Notifications */}
                <Link
                    href="/notifications"
                    className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </Link>

                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                            {adminUser?.profile_photo_url ? (
                                <Image
                                    src={adminUser.profile_photo_url}
                                    alt="Profile"
                                    width={36}
                                    height={36}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-white font-medium text-sm">
                                    {adminUser?.first_name?.[0] || adminUser?.email?.[0]?.toUpperCase() || 'A'}
                                </span>
                            )}
                        </div>
                    </button>

                    {showDropdown && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-2 border-b border-gray-100">
                                <p className="font-medium text-gray-900">
                                    {adminUser?.full_name || adminUser?.email}
                                </p>
                                <p className="text-sm text-gray-500">{adminUser?.email}</p>
                            </div>

                            <Link
                                href="/settings"
                                onClick={() => setShowDropdown(false)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <Settings className="w-4 h-4" />
                                Settings
                            </Link>

                            <button
                                onClick={async () => {
                                    setShowDropdown(false);
                                    await signOut();
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
