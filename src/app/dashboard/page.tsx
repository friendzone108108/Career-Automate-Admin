'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import {
    Users,
    Briefcase,
    FileText,
    Key,
    TrendingUp,
    UserPlus,
    MoreVertical,
    X
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface DashboardStats {
    totalUsers: number;
    activeJobSearchers: number;
    pendingDocuments: number;
    apiKeyAlerts: number;
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
        activeJobSearchers: 0,
        pendingDocuments: 0,
        apiKeyAlerts: 0,
        newSignups: 0
    });
    const [loading, setLoading] = useState(true);

    // Filtered counts
    const [filteredTotalUsers, setFilteredTotalUsers] = useState<number | null>(null);
    const [filteredActiveSearchers, setFilteredActiveSearchers] = useState<number | null>(null);

    // Filter states for each card
    const [totalUsersFilter, setTotalUsersFilter] = useState<FilterState>({
        location: '',
        newUsers: false,
        oldUsers: false
    });
    const [activeSearchFilter, setActiveSearchFilter] = useState<FilterState>({
        location: '',
        newUsers: false,
        oldUsers: false
    });

    // Location filter modal
    const [showLocationModal, setShowLocationModal] = useState<'totalUsers' | 'activeSearchers' | null>(null);
    const [selectedLocation, setSelectedLocation] = useState('');

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

    useEffect(() => {
        if (activeSearchFilter.location || activeSearchFilter.newUsers || activeSearchFilter.oldUsers) {
            fetchFilteredStats('activeJobSearchers', activeSearchFilter);
        } else {
            setFilteredActiveSearchers(null);
        }
    }, [activeSearchFilter]);

    const fetchDashboardStats = async () => {
        try {
            const response = await fetch('/api/dashboard/stats');
            const data = await response.json();

            if (response.ok) {
                setStats(data);
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
                if (statType === 'totalUsers') {
                    setFilteredTotalUsers(data.count);
                } else {
                    setFilteredActiveSearchers(data.count);
                }
            }
        } catch (error) {
            console.error('Error fetching filtered stats:', error);
        }
    };

    const handleFilterChange = (
        cardType: 'totalUsers' | 'activeSearchers',
        filterKey: 'newUsers' | 'oldUsers'
    ) => {
        if (cardType === 'totalUsers') {
            setTotalUsersFilter(prev => ({
                ...prev,
                [filterKey]: !prev[filterKey],
                // Ensure only one time filter is active
                ...(filterKey === 'newUsers' && !prev.newUsers ? { oldUsers: false } : {}),
                ...(filterKey === 'oldUsers' && !prev.oldUsers ? { newUsers: false } : {})
            }));
        } else {
            setActiveSearchFilter(prev => ({
                ...prev,
                [filterKey]: !prev[filterKey],
                ...(filterKey === 'newUsers' && !prev.newUsers ? { oldUsers: false } : {}),
                ...(filterKey === 'oldUsers' && !prev.oldUsers ? { newUsers: false } : {})
            }));
        }
    };

    const handleLocationSelect = (location: string) => {
        if (showLocationModal === 'totalUsers') {
            setTotalUsersFilter(prev => ({ ...prev, location }));
        } else if (showLocationModal === 'activeSearchers') {
            setActiveSearchFilter(prev => ({ ...prev, location }));
        }
        setShowLocationModal(null);
        setSelectedLocation('');
    };

    const clearFilters = (cardType: 'totalUsers' | 'activeSearchers') => {
        if (cardType === 'totalUsers') {
            setTotalUsersFilter({ location: '', newUsers: false, oldUsers: false });
            setFilteredTotalUsers(null);
        } else {
            setActiveSearchFilter({ location: '', newUsers: false, oldUsers: false });
            setFilteredActiveSearchers(null);
        }
    };

    const StatCard = ({
        title,
        value,
        filteredValue,
        icon: Icon,
        subtitle,
        filters,
        cardType,
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
        cardType?: 'totalUsers' | 'activeSearchers';
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
                        <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    {filters && cardType && onFilterChange && (
                        <div className="mt-4">
                            <div className="flex flex-wrap gap-2">
                                {/* Location Filter */}
                                <button
                                    onClick={() => setShowLocationModal(cardType)}
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
                                                if (cardType === 'totalUsers') {
                                                    setTotalUsersFilter(prev => ({ ...prev, location: '' }));
                                                } else {
                                                    setActiveSearchFilter(prev => ({ ...prev, location: '' }));
                                                }
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Total Users */}
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers}
                        filteredValue={filteredTotalUsers}
                        icon={Users}
                        filters={totalUsersFilter}
                        cardType="totalUsers"
                        onFilterChange={(key) => handleFilterChange('totalUsers', key)}
                        onClearFilters={() => clearFilters('totalUsers')}
                    />

                    {/* Active Job Searchers */}
                    <StatCard
                        title="Active Job Searchers"
                        value={stats.activeJobSearchers}
                        filteredValue={filteredActiveSearchers}
                        icon={Briefcase}
                        filters={activeSearchFilter}
                        cardType="activeSearchers"
                        onFilterChange={(key) => handleFilterChange('activeSearchers', key)}
                        onClearFilters={() => clearFilters('activeSearchers')}
                    />

                    {/* Pending Documents */}
                    <StatCard
                        title="Pending Documents"
                        value={stats.pendingDocuments}
                        icon={FileText}
                        subtitle={stats.pendingDocuments > 0 ? `From ${Math.ceil(stats.pendingDocuments / 2)} users` : 'All documents reviewed'}
                    />

                    {/* API Key Expiry Alerts */}
                    <StatCard
                        title="API Key Expiry Alerts"
                        value={stats.apiKeyAlerts}
                        icon={Key}
                        subtitle={stats.apiKeyAlerts > 0 ? "Approaching expiry" : "All keys valid"}
                    />

                    {/* Revenue - Placeholder */}
                    <StatCard
                        title="Revenue"
                        value={12345}
                        icon={TrendingUp}
                        trend="up"
                        trendValue="+15%"
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
