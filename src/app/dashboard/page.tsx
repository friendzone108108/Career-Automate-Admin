'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import {
    Users,
    UserPlus,
    MoreVertical,
    X
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface DashboardStats {
    totalUsers: number;
    newSignups: number;
}

interface FilterState {
    location: string;
    newUsers: boolean;
    oldUsers: boolean;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        newSignups: 0
    });
    const [loading, setLoading] = useState(true);

    // Filtered counts
    const [filteredTotalUsers, setFilteredTotalUsers] = useState<number | null>(null);

    // Filter states for each card
    const [totalUsersFilter, setTotalUsersFilter] = useState<FilterState>({
        location: '',
        newUsers: false,
        oldUsers: false
    });

    // Location filter modal
    const [showLocationModal, setShowLocationModal] = useState<'totalUsers' | null>(null);

    const locations = [
        'Bangalore', 'Hyderabad', 'Mumbai', 'Delhi', 'Chennai',
        'Pune', 'Kolkata', 'Remote', 'India'
    ];

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    // Fetch filtered stats when filters change
    useEffect(() => {
        if (totalUsersFilter.location || totalUsersFilter.newUsers || totalUsersFilter.oldUsers) {
            fetchFilteredStats('totalUsers', totalUsersFilter);
        } else {
            setFilteredTotalUsers(null);
        }
    }, [totalUsersFilter]);

    const fetchDashboardStats = async () => {
        try {
            const response = await fetch('/api/dashboard/stats');
            const data = await response.json();

            if (response.ok) {
                setStats({
                    totalUsers: data.totalUsers || 0,
                    newSignups: data.newSignups || 0
                });
            } else {
                console.error('Error fetching stats:', data.error);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFilteredStats = async (statType: string, filters: FilterState) => {
        try {
            const params = new URLSearchParams();
            params.set('statType', statType);
            if (filters.location) params.set('location', filters.location);
            if (filters.newUsers) params.set('newUsers', 'true');
            if (filters.oldUsers) params.set('oldUsers', 'true');

            const response = await fetch(`/api/dashboard/filtered-stats?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                setFilteredTotalUsers(data.count);
            }
        } catch (error) {
            console.error('Error fetching filtered stats:', error);
        }
    };

    const handleFilterChange = (filterKey: 'newUsers' | 'oldUsers') => {
        setTotalUsersFilter(prev => ({
            ...prev,
            [filterKey]: !prev[filterKey],
            // Ensure only one time filter is active
            ...(filterKey === 'newUsers' && !prev.newUsers ? { oldUsers: false } : {}),
            ...(filterKey === 'oldUsers' && !prev.oldUsers ? { newUsers: false } : {})
        }));
    };

    const handleLocationSelect = (location: string) => {
        setTotalUsersFilter(prev => ({ ...prev, location }));
        setShowLocationModal(null);
    };

    const clearFilters = () => {
        setTotalUsersFilter({ location: '', newUsers: false, oldUsers: false });
        setFilteredTotalUsers(null);
    };

    const StatCard = ({
        title,
        value,
        filteredValue,
        icon: Icon,
        subtitle,
        filters,
        hasFilters,
        onFilterChange,
        onClearFilters,
        trend,
        trendValue
    }: {
        title: string;
        value: number;
        filteredValue?: number | null;
        icon: React.ElementType;
        subtitle?: string;
        filters?: FilterState;
        hasFilters?: boolean;
        onFilterChange?: (filterKey: 'newUsers' | 'oldUsers') => void;
        onClearFilters?: () => void;
        trend?: 'up' | 'down';
        trendValue?: string;
    }) => {
        const displayValue = filteredValue !== null && filteredValue !== undefined ? filteredValue : value;
        const isFiltered = filters && (filters.location || filters.newUsers || filters.oldUsers);

        return (
            <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">{title}</p>
                            <div className="flex items-baseline gap-2 mt-2">
                                <p className="text-3xl font-bold text-gray-900">
                                    {loading ? (
                                        <span className="inline-block w-16 h-8 skeleton rounded"></span>
                                    ) : (
                                        displayValue.toLocaleString()
                                    )}
                                </p>
                                {isFiltered && filteredValue !== null && (
                                    <span className="text-sm text-gray-400">
                                        of {value.toLocaleString()}
                                    </span>
                                )}
                            </div>
                            {subtitle && (
                                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                            )}
                            {trendValue && (
                                <p className={`text-sm mt-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                    {trend === 'up' ? '+' : ''}{trendValue}
                                </p>
                            )}
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Icon className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>

                    {hasFilters && filters && onFilterChange && (
                        <div className="mt-4">
                            <div className="flex flex-wrap gap-2">
                                {/* Location Filter */}
                                <button
                                    onClick={() => setShowLocationModal('totalUsers')}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filters.location
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        }`}
                                >
                                    {filters.location || 'Location'}
                                    {filters.location && (
                                        <X
                                            className="w-3 h-3 ml-1 inline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTotalUsersFilter(prev => ({ ...prev, location: '' }));
                                            }}
                                        />
                                    )}
                                </button>

                                {/* New Users Filter */}
                                <button
                                    onClick={() => onFilterChange('newUsers')}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filters.newUsers
                                        ? 'bg-green-600 text-white'
                                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                                        }`}
                                >
                                    New Users
                                </button>

                                {/* Old Users Filter */}
                                <button
                                    onClick={() => onFilterChange('oldUsers')}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filters.oldUsers
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Old Users
                                </button>
                            </div>

                            {isFiltered && onClearFilters && (
                                <button
                                    onClick={onClearFilters}
                                    className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Total Users */}
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers}
                        filteredValue={filteredTotalUsers}
                        icon={Users}
                        filters={totalUsersFilter}
                        hasFilters={true}
                        onFilterChange={handleFilterChange}
                        onClearFilters={clearFilters}
                    />

                    {/* New Signups */}
                    <StatCard
                        title="New Signups (7 days)"
                        value={stats.newSignups}
                        icon={UserPlus}
                        trend="up"
                        trendValue="+8%"
                    />
                </div>
            </div>

            {/* Location Selection Modal */}
            {showLocationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Select Location</h2>
                            <button
                                onClick={() => setShowLocationModal(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {locations.map((loc) => (
                                <button
                                    key={loc}
                                    onClick={() => handleLocationSelect(loc)}
                                    className="px-4 py-2 text-sm text-left rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                >
                                    {loc}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
