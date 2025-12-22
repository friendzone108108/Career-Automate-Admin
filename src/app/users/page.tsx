'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
    Search,
    FileText,
    Mail,
    UserX,
    ChevronLeft,
    ChevronRight,
    Plus,
    Github
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createFrontendServiceClient, createAdminServiceClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface UserProfile {
    id: string;
    full_name: string | null;
    address: string | null;
    github_username: string | null;
    skills: string[] | null;
    career_preferences: {
        roles_targeted?: string[];
        preferred_locations?: string[];
    } | null;
    created_at: string;
}

interface UserWithEmail {
    profile: UserProfile;
    email: string;
    is_verified: boolean;
    job_status?: string;
}

export default function UsersPage() {
    const { adminUser } = useAuth();
    const [users, setUsers] = useState<UserWithEmail[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [signupFilter, setSignupFilter] = useState('');
    const [userTypeFilter, setUserTypeFilter] = useState('');
    const [preferencesFilter, setPreferencesFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const pageSize = 10;

    useEffect(() => {
        fetchUsers();
    }, [currentPage, locationFilter, signupFilter, userTypeFilter, preferencesFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const frontendClient = createFrontendServiceClient();

            // Fetch profiles with pagination
            let query = frontendClient
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

            // Apply filters
            if (searchQuery) {
                query = query.ilike('full_name', `%${searchQuery}%`);
            }

            const { data: profiles, count, error } = await query;

            if (error) {
                console.error('Error fetching profiles:', error);
                return;
            }

            setTotalUsers(count || 0);

            // Fetch user emails and verification status
            if (profiles && profiles.length > 0) {
                const userIds = profiles.map(p => p.id);

                const { data: usersData } = await frontendClient
                    .from('users')
                    .select('id, email, is_verified')
                    .in('id', userIds);

                // Fetch job search status
                const { data: jobStatus } = await frontendClient
                    .from('job_search_status')
                    .select('user_id, is_active')
                    .in('user_id', userIds);

                const usersWithEmail: UserWithEmail[] = profiles.map(profile => {
                    const userInfo = usersData?.find(u => u.id === profile.id);
                    const jobInfo = jobStatus?.find(j => j.user_id === profile.id);

                    return {
                        profile,
                        email: userInfo?.email || 'Unknown',
                        is_verified: userInfo?.is_verified || false,
                        job_status: jobInfo?.is_active ? 'Actively looking' : 'Not available'
                    };
                });

                setUsers(usersWithEmail);
            } else {
                setUsers([]);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setCurrentPage(1);
        fetchUsers();
    };

    const handleBlockUser = async (userId: string, userEmail: string) => {
        if (!confirm(`Are you sure you want to block user ${userEmail}?`)) return;

        try {
            const adminClient = createAdminServiceClient();

            await adminClient.from('blocked_users').upsert({
                user_id: userId,
                user_email: userEmail,
                blocked_by: adminUser?.id,
                blocked_at: new Date().toISOString(),
                is_blocked: true
            });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'block_user',
                action_description: `Blocked user: ${userEmail}`,
                target_user_id: userId,
                target_user_email: userEmail
            });

            toast.success(`User ${userEmail} has been blocked`);
        } catch (error) {
            console.error('Error blocking user:', error);
            toast.error('Failed to block user');
        }
    };

    const getJobStatusBadge = (status: string | undefined) => {
        switch (status) {
            case 'Actively looking':
                return <Badge variant="success">{status}</Badge>;
            case 'Open to offers':
                return <Badge variant="info">{status}</Badge>;
            case 'Suspended':
                return <Badge variant="danger">{status}</Badge>;
            default:
                return <Badge variant="default">{status || 'Not available'}</Badge>;
        }
    };

    const totalPages = Math.ceil(totalUsers / pageSize);

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </div>

                {/* Filters */}
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex-1 min-w-[200px] max-w-sm">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <Select
                                options={[
                                    { value: '', label: 'All Locations' },
                                    { value: 'bangalore', label: 'Bangalore' },
                                    { value: 'hyderabad', label: 'Hyderabad' },
                                    { value: 'mumbai', label: 'Mumbai' },
                                    { value: 'delhi', label: 'Delhi' },
                                    { value: 'remote', label: 'Remote' },
                                ]}
                                value={locationFilter}
                                onChange={setLocationFilter}
                                placeholder="Location"
                                className="w-40"
                            />

                            <Select
                                options={[
                                    { value: '', label: 'All Time' },
                                    { value: '7days', label: 'Last 7 days' },
                                    { value: '30days', label: 'Last 30 days' },
                                    { value: '90days', label: 'Last 90 days' },
                                ]}
                                value={signupFilter}
                                onChange={setSignupFilter}
                                placeholder="Signup Date"
                                className="w-40"
                            />

                            <Select
                                options={[
                                    { value: '', label: 'All Types' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'inactive', label: 'Inactive' },
                                    { value: 'blocked', label: 'Blocked' },
                                ]}
                                value={userTypeFilter}
                                onChange={setUserTypeFilter}
                                placeholder="User Type"
                                className="w-40"
                            />

                            <Select
                                options={[
                                    { value: '', label: 'All Preferences' },
                                    { value: 'software', label: 'Software Engineer' },
                                    { value: 'data', label: 'Data Scientist' },
                                    { value: 'product', label: 'Product Manager' },
                                    { value: 'design', label: 'UX Designer' },
                                ]}
                                value={preferencesFilter}
                                onChange={setPreferencesFilter}
                                placeholder="Preferences"
                                className="w-40"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Users Table */}
                <Card>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Target Role</th>
                                    <th>Job Status</th>
                                    <th>GitHub</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i}>
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-48 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-20 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-12 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                        </tr>
                                    ))
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-500">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.profile.id}>
                                            <td>
                                                <div className="font-medium text-gray-900">
                                                    {user.profile.full_name || 'Unnamed User'}
                                                </div>
                                            </td>
                                            <td className="text-gray-600">{user.email}</td>
                                            <td>
                                                {user.profile.career_preferences?.roles_targeted?.[0] || 'Not specified'}
                                            </td>
                                            <td>{getJobStatusBadge(user.job_status)}</td>
                                            <td>
                                                {user.profile.github_username ? (
                                                    <span className="text-green-600 font-medium">Yes</span>
                                                ) : (
                                                    <span className="text-gray-400">No</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/users/${user.profile.id}/documents`}
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Documents"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Send Email"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleBlockUser(user.profile.id, user.email)}
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Block User"
                                                    >
                                                        <UserX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} results
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </AdminLayout>
    );
}
