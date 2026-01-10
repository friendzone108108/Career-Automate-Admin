'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useEffect, useState } from 'react';
import { createAdminServiceClient, createFrontendServiceClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Search, Mail, Loader2 } from 'lucide-react';

interface BroadcastNotification {
    id: string;
    notification_type: string;
    message: string;
    target_audience: string;
    target_user_email: string | null;
    delivery_status: string;
    created_at: string;
}

export default function NotificationsPage() {
    const { adminUser } = useAuth();
    const [notifications, setNotifications] = useState<BroadcastNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Form state
    const [targetAudience, setTargetAudience] = useState<'all' | 'single'>('all');
    const [notificationType, setNotificationType] = useState('new_feature');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; primary_email?: string } | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const adminClient = createAdminServiceClient();

            const { data, error } = await adminClient
                .from('broadcast_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchUser = async () => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);
        try {
            const frontendClient = createFrontendServiceClient();

            // Search in profiles for primary_email and users for email
            const { data: profiles } = await frontendClient
                .from('profiles')
                .select('id, full_name, primary_email')
                .or(`full_name.ilike.%${searchQuery}%,primary_email.ilike.%${searchQuery}%`)
                .limit(10);

            const { data: users } = await frontendClient
                .from('users')
                .select('id, email')
                .ilike('email', `%${searchQuery}%`)
                .limit(10);

            // Combine results
            const results: any[] = [];
            const seenIds = new Set();

            profiles?.forEach(p => {
                if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    const user = users?.find(u => u.id === p.id);
                    results.push({
                        id: p.id,
                        full_name: p.full_name || 'Unknown',
                        email: user?.email || '',
                        primary_email: p.primary_email
                    });
                }
            });

            users?.forEach(u => {
                if (!seenIds.has(u.id)) {
                    seenIds.add(u.id);
                    results.push({
                        id: u.id,
                        full_name: 'Unknown',
                        email: u.email,
                        primary_email: null
                    });
                }
            });

            setSearchResults(results);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleCreateNotification = async () => {
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        if (!subject.trim()) {
            toast.error('Please enter a subject');
            return;
        }

        if (targetAudience === 'single' && !selectedUser) {
            toast.error('Please select a user');
            return;
        }

        setSending(true);
        try {
            const adminClient = createAdminServiceClient();

            // Send email via API
            const emailPayload: any = {
                subject: subject,
                message: message,
                notificationType: notificationType,
                targetAudience: targetAudience
            };

            if (targetAudience === 'single' && selectedUser) {
                emailPayload.recipientEmail = selectedUser.primary_email || selectedUser.email;
                emailPayload.recipientId = selectedUser.id;
            }

            // Call the email sending API
            const response = await fetch('/api/notifications/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send email');
            }

            // Create broadcast notification record
            await adminClient
                .from('broadcast_notifications')
                .insert({
                    target_audience: targetAudience,
                    target_user_id: targetAudience === 'single' ? selectedUser?.id : null,
                    target_user_email: targetAudience === 'single' ? (selectedUser?.primary_email || selectedUser?.email) : null,
                    notification_type: notificationType,
                    message: message,
                    delivery_status: 'delivered',
                    delivered_at: new Date().toISOString(),
                    created_by: adminUser?.id
                });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'send_notification',
                action_description: `Sent ${notificationType} email to ${targetAudience === 'all' ? 'all users' : (selectedUser?.primary_email || selectedUser?.email)}`,
                metadata: { type: notificationType, audience: targetAudience, emailsSent: result.emailsSent || 1 }
            });

            toast.success(`Email sent successfully${result.emailsSent ? ` to ${result.emailsSent} users` : ''}`);
            setMessage('');
            setSubject('');
            setSelectedUser(null);
            setSearchQuery('');
            fetchNotifications();
        } catch (error: any) {
            console.error('Error sending notification:', error);
            toast.error(error.message || 'Failed to send notification');
        } finally {
            setSending(false);
        }
    };

    const getTypeBadge = (type: string) => {
        const formatted = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        return <span className="font-medium text-gray-900">{formatted}</span>;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'delivered':
                return <Badge variant="success">Delivered</Badge>;
            case 'pending':
                return <Badge variant="warning">Pending</Badge>;
            case 'failed':
                return <Badge variant="danger">Failed</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Email Notifications</h1>
                    <p className="text-gray-500 mt-1">Send email notifications to users</p>
                </div>

                {/* Create Notification */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Create Email Notification</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            {/* Target Audience */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Target Audience
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setTargetAudience('all');
                                            setSelectedUser(null);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                        }}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${targetAudience === 'all'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        All Users
                                    </button>
                                    <button
                                        onClick={() => setTargetAudience('single')}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${targetAudience === 'single'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        Single User
                                    </button>
                                </div>

                                {/* User Search (shown when single user selected) */}
                                {targetAudience === 'single' && (
                                    <div className="mt-3 relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search by name or email..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    if (e.target.value.length > 2) {
                                                        handleSearchUser();
                                                    } else {
                                                        setSearchResults([]);
                                                    }
                                                }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                                                className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            {searchLoading && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                                            )}
                                        </div>

                                        {searchResults.length > 0 && (
                                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                                                {searchResults.map((user) => (
                                                    <button
                                                        key={user.id}
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setSearchResults([]);
                                                            setSearchQuery(user.primary_email || user.email);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                                                    >
                                                        <p className="font-medium text-gray-900">{user.full_name}</p>
                                                        <p className="text-gray-500 text-xs">{user.primary_email || user.email}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {selectedUser && (
                                            <div className="mt-2 p-2 bg-green-50 rounded-lg flex items-center justify-between">
                                                <p className="text-sm text-green-700">
                                                    <span className="font-medium">Selected:</span> {selectedUser.primary_email || selectedUser.email}
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(null);
                                                        setSearchQuery('');
                                                    }}
                                                    className="text-green-600 hover:text-green-800 text-sm"
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Notification Type */}
                            <Select
                                label="Notification Type"
                                options={[
                                    { value: 'new_feature', label: 'New Feature' },
                                    { value: 'reminder', label: 'Reminder' },
                                    { value: 'welcome', label: 'Welcome' },
                                    { value: 'maintenance', label: 'Maintenance' },
                                    { value: 'update', label: 'Update' },
                                    { value: 'alert', label: 'Alert' },
                                ]}
                                value={notificationType}
                                onChange={setNotificationType}
                            />
                        </div>

                        {/* Subject */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Enter email subject..."
                                className="w-full h-10 px-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Message */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter your email message..."
                                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleCreateNotification} loading={sending}>
                                <Mail className="w-4 h-4 mr-2" />
                                Send Email
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Past Notifications */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sent Emails</h2>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Target</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        [...Array(3)].map((_, i) => (
                                            <tr key={i}>
                                                <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-20 h-4 skeleton rounded"></div></td>
                                            </tr>
                                        ))
                                    ) : notifications.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8 text-gray-500">
                                                No emails sent yet
                                            </td>
                                        </tr>
                                    ) : (
                                        notifications.map((notification) => (
                                            <tr key={notification.id}>
                                                <td>{getTypeBadge(notification.notification_type)}</td>
                                                <td className="text-gray-600">
                                                    {notification.target_audience === 'all'
                                                        ? 'All Users'
                                                        : notification.target_user_email || 'Single User'}
                                                </td>
                                                <td className="text-gray-600">{formatDate(notification.created_at)}</td>
                                                <td>{getStatusBadge(notification.delivery_status)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
