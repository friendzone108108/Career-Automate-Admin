'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import {
    Search,
    FileText,
    Mail,
    UserX,
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Send,
    Loader2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface User {
    id: string;
    full_name: string;
    email: string;
    primary_email: string | null;
    is_verified: boolean;
    address: string | null;
    github_username: string | null;
    skills: string[] | null;
    career_preferences: {
        roles_targeted?: string[];
        preferred_locations?: string[];
    } | null;
    is_blocked: boolean;
    created_at: string;
}

export default function UsersPage() {
    const { adminUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [signupFilter, setSignupFilter] = useState('');
    const [userTypeFilter, setUserTypeFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const pageSize = 10;

    // Email modal state
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<User | null>(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, [currentPage, locationFilter, signupFilter, userTypeFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('pageSize', pageSize.toString());
            if (searchQuery) params.set('search', searchQuery);
            if (locationFilter) params.set('location', locationFilter);
            if (signupFilter) params.set('signup', signupFilter);
            if (userTypeFilter) params.set('userType', userTypeFilter);

            const response = await fetch(`/api/users?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                setUsers(data.users || []);
                setTotalUsers(data.total || 0);
            } else {
                console.error('Error fetching users:', data.error);
                toast.error('Failed to load users');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to load users');
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
            const { error } = await adminSupabase.from('blocked_users').upsert({
                user_id: userId,
                user_email: userEmail,
                blocked_by: adminUser?.id,
                blocked_at: new Date().toISOString(),
                is_blocked: true
            });

            if (error) throw error;

            // Log the action
            await adminSupabase.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'block_user',
                action_description: `Blocked user: ${userEmail}`,
                target_user_id: userId,
                target_user_email: userEmail
            });

            toast.success(`User ${userEmail} has been blocked`);
            fetchUsers(); // Refresh the list
        } catch (error) {
            console.error('Error blocking user:', error);
            toast.error('Failed to block user');
        }
    };

    const handleSendEmail = (user: User) => {
        // Get the user's primary email or fallback to auth email
        const recipientEmail = user.primary_email || user.email;

        if (!recipientEmail) {
            toast.error('No email address available for this user');
            return;
        }

        // Open the email modal
        setEmailRecipient(user);
        setEmailSubject('');
        setEmailMessage('');
        setEmailModalOpen(true);
    };

    const handleCloseEmailModal = () => {
        setEmailModalOpen(false);
        setEmailRecipient(null);
        setEmailSubject('');
        setEmailMessage('');
    };

    const handleSubmitEmail = async () => {
        if (!emailRecipient) return;

        if (!emailSubject.trim()) {
            toast.error('Please enter a subject');
            return;
        }
        if (!emailMessage.trim()) {
            toast.error('Please enter a message');
            return;
        }

        setSendingEmail(true);
        try {
            const recipientEmail = emailRecipient.primary_email || emailRecipient.email;

            const response = await fetch('/api/notifications/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: emailSubject,
                    message: emailMessage,
                    notificationType: 'direct_message',
                    targetAudience: 'single',
                    recipientEmail: recipientEmail,
                    recipientId: emailRecipient.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send email');
            }

            toast.success(`Email sent successfully to ${recipientEmail}!`);
            handleCloseEmailModal();
        } catch (error: any) {
            console.error('Error sending email:', error);
            toast.error(error.message || 'Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    const getUserEmail = (user: User) => {
        // Show primary_email if available, otherwise show auth email
        return user.primary_email || user.email;
    };

    const getTargetRoles = (user: User) => {
        const roles = user.career_preferences?.roles_targeted;
        if (!roles || roles.length === 0) {
            return <span className="text-gray-400">Not specified</span>;
        }

        // Show all roles as badges
        return (
            <div className="flex flex-wrap gap-1">
                {roles.map((role, index) => (
                    <Badge key={index} variant="info" className="text-xs">
                        {role}
                    </Badge>
                ))}
            </div>
        );
    };

    const totalPages = Math.ceil(totalUsers / pageSize);

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
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
                                        placeholder="Search by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <Button variant="secondary" onClick={handleSearch}>
                                Search
                            </Button>

                            <Select
                                options={[
                                    { value: '', label: 'All Locations' },
                                    { value: 'bangalore', label: 'Bangalore' },
                                    { value: 'hyderabad', label: 'Hyderabad' },
                                    { value: 'mumbai', label: 'Mumbai' },
                                    { value: 'delhi', label: 'Delhi' },
                                    { value: 'chennai', label: 'Chennai' },
                                    { value: 'pune', label: 'Pune' },
                                    { value: 'remote', label: 'Remote' },
                                ]}
                                value={locationFilter}
                                onChange={(val) => {
                                    setLocationFilter(val);
                                    setCurrentPage(1);
                                }}
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
                                onChange={(val) => {
                                    setSignupFilter(val);
                                    setCurrentPage(1);
                                }}
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
                                onChange={(val) => {
                                    setUserTypeFilter(val);
                                    setCurrentPage(1);
                                }}
                                placeholder="User Type"
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
                                    <th>Target Roles</th>
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
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-12 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                        </tr>
                                    ))
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-500">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="font-medium text-gray-900">
                                                    {user.full_name}
                                                </div>
                                            </td>
                                            <td className="text-gray-600">{getUserEmail(user)}</td>
                                            <td>{getTargetRoles(user)}</td>
                                            <td>
                                                {user.github_username ? (
                                                    <span className="text-green-600 font-medium">Yes</span>
                                                ) : (
                                                    <span className="text-gray-400">No</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/users/${user.id}/documents`}
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Documents"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleSendEmail(user)}
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Send Email"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                    {!user.is_blocked && (
                                                        <button
                                                            onClick={() => handleBlockUser(user.id, getUserEmail(user))}
                                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Block User"
                                                        >
                                                            <UserX className="w-4 h-4" />
                                                        </button>
                                                    )}
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
                            {totalUsers > 0 ? (
                                <>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} results</>
                            ) : (
                                <>No results</>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages || 1}
                            </span>
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

            {/* Email Compose Modal */}
            {emailModalOpen && emailRecipient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Mail className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Send Email</h3>
                                    <p className="text-sm text-gray-500">Compose a message to this user</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseEmailModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            {/* Recipient (Read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                                <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{emailRecipient.full_name}</span>
                                        <span className="text-gray-500">({emailRecipient.primary_email || emailRecipient.email})</span>
                                    </div>
                                </div>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                <Input
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Enter email subject..."
                                    className="w-full"
                                />
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    value={emailMessage}
                                    onChange={(e) => setEmailMessage(e.target.value)}
                                    placeholder="Write your message here..."
                                    rows={6}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                            <Button
                                variant="ghost"
                                onClick={handleCloseEmailModal}
                                disabled={sendingEmail}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitEmail}
                                disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                                {sendingEmail ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Send Email
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
