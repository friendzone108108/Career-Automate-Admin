'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
    Users,
    Briefcase,
    FileText,
    Key,
    TrendingUp,
    UserPlus,
    MoreVertical
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createFrontendServiceClient, createAdminServiceClient } from '@/lib/supabase';

interface DashboardStats {
    totalUsers: number;
    activeJobSearchers: number;
    pendingDocuments: number;
    apiKeyAlerts: number;
    newSignups: number;
}

interface FilterState {
    location: boolean;
    preferences: boolean;
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
    const [totalUsersFilter, setTotalUsersFilter] = useState<FilterState>({
        location: false,
        preferences: false,
        newUsers: false,
        oldUsers: false
    });
    const [activeSearchFilter, setActiveSearchFilter] = useState<FilterState>({
        location: false,
        preferences: false,
        newUsers: false,
        oldUsers: false
    });

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const frontendClient = createFrontendServiceClient();
            const adminClient = createAdminServiceClient();

            // Fetch total users from frontend DB
            const { count: totalUsers } = await frontendClient
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            // Fetch active job searchers
            const { count: activeJobSearchers } = await frontendClient
                .from('job_search_status')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // Fetch pending documents
            const { count: pendingDocs } = await adminClient
                .from('document_verifications')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // Fetch API key expiry alerts (keys expiring in next 30 days)
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const { count: apiAlerts } = await adminClient
                .from('api_keys')
                .select('*', { count: 'exact', head: true })
                .lte('expiry_date', thirtyDaysFromNow.toISOString())
                .eq('is_active', true);

            // Fetch new signups (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { count: newSignups } = await frontendClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', sevenDaysAgo.toISOString());

            setStats({
                totalUsers: totalUsers || 0,
                activeJobSearchers: activeJobSearchers || 0,
                pendingDocuments: pendingDocs || 0,
                apiKeyAlerts: apiAlerts || 0,
                newSignups: newSignups || 0
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({
        title,
        value,
        icon: Icon,
        subtitle,
        filters,
        onFilterChange,
        trend,
        trendValue
    }: {
        title: string;
        value: number;
        icon: React.ElementType;
        subtitle?: string;
        filters?: FilterState;
        onFilterChange?: (filter: keyof FilterState) => void;
        trend?: 'up' | 'down';
        trendValue?: string;
    }) => (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                            {loading ? (
                                <span className="inline-block w-16 h-8 skeleton rounded"></span>
                            ) : (
                                value.toLocaleString()
                            )}
                        </p>
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

                {filters && onFilterChange && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        <button
                            onClick={() => onFilterChange('location')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filters.location
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                }`}
                        >
                            Location
                        </button>
                        <button
                            onClick={() => onFilterChange('preferences')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filters.preferences
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                                }`}
                        >
                            Preferences
                        </button>
                        <button
                            onClick={() => onFilterChange('newUsers')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filters.newUsers
                                    ? 'bg-gray-700 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            New Users
                        </button>
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
                )}
            </CardContent>
        </Card>
    );

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Total Users */}
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers}
                        icon={Users}
                        filters={totalUsersFilter}
                        onFilterChange={(filter) => setTotalUsersFilter(prev => ({ ...prev, [filter]: !prev[filter] }))}
                    />

                    {/* Active Job Searchers */}
                    <StatCard
                        title="Active Job Searchers"
                        value={stats.activeJobSearchers}
                        icon={Briefcase}
                        filters={activeSearchFilter}
                        onFilterChange={(filter) => setActiveSearchFilter(prev => ({ ...prev, [filter]: !prev[filter] }))}
                    />

                    {/* Pending Documents */}
                    <StatCard
                        title="Pending Documents"
                        value={stats.pendingDocuments}
                        icon={FileText}
                        subtitle={`From ${Math.ceil(stats.pendingDocuments / 2)} users`}
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
                        title="New Signups"
                        value={stats.newSignups}
                        icon={UserPlus}
                        trend="up"
                        trendValue="+8%"
                    />
                </div>
            </div>
        </AdminLayout>
    );
}
