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
import { Search } from 'lucide-react';

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
    const [message, setMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<{ id: string; email: string } | null>(null);

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
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            const frontendClient = createFrontendServiceClient();

            const { data } = await frontendClient
                .from('users')
                .select('id, email')
                .ilike('email', `%${searchQuery}%`)
                .limit(5);

            setSearchResults(data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        }
    };

    const handleCreateNotification = async () => {
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        if (targetAudience === 'single' && !selectedUser) {
            toast.error('Please select a user');
            return;
        }

        setSending(true);
        try {
            const adminClient = createAdminServiceClient();

            // Create broadcast notification record
            const { error } = await adminClient
                .from('broadcast_notifications')
                .insert({
                    target_audience: targetAudience,
                    target_user_id: targetAudience === 'single' ? selectedUser?.id : null,
                    target_user_email: targetAudience === 'single' ? selectedUser?.email : null,
                    notification_type: notificationType,
                    message: message,
                    delivery_status: 'delivered', // In production, this would be updated after actual delivery
                    delivered_at: new Date().toISOString(),
                    created_by: adminUser?.id
                });

            if (error) throw error;

            // If targeting all users, create notifications in frontend DB
            if (targetAudience === 'all') {
                const frontendClient = createFrontendServiceClient();

                // Fetch all user IDs
                const { data: users } = await frontendClient
                    .from('users')
                    .select('id');

                if (users && users.length > 0) {
                    const notificationsToInsert = users.map(user => ({
                        user_id: user.id,
                        title: notificationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        message: message,
                        type: 'info',
                        is_read: false
                    }));

                    await frontendClient
                        .from('notifications')
                        .insert(notificationsToInsert);
                }
            } else if (selectedUser) {
                // Single user notification
                const frontendClient = createFrontendServiceClient();

                await frontendClient
                    .from('notifications')
                    .insert({
                        user_id: selectedUser.id,
                        title: notificationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        message: message,
                        type: 'info',
                        is_read: false
                    });
            }

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'send_notification',
                action_description: `Sent ${notificationType} notification to ${targetAudience === 'all' ? 'all users' : selectedUser?.email}`,
                metadata: { type: notificationType, audience: targetAudience }
            });

            toast.success('Notification sent successfully');
            setMessage('');
            setSelectedUser(null);
            setSearchQuery('');
            fetchNotifications();
        } catch (error) {
            console.error('Error sending notification:', error);
            toast.error('Failed to send notification');
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
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Notifications</h1>

                {/* Create Notification */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Notification</h2>

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
                                                placeholder="Search user by email..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    if (e.target.value.length > 2) handleSearchUser();
                                                }}
                                                className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {searchResults.length > 0 && (
                                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                                                {searchResults.map((user) => (
                                                    <button
                                                        key={user.id}
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setSearchResults([]);
                                                            setSearchQuery(user.email);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                                                    >
                                                        {user.email}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {selectedUser && (
                                            <p className="mt-2 text-sm text-green-600">
                                                Selected: {selectedUser.email}
                                            </p>
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

                        {/* Message */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter your notification message..."
                                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleCreateNotification} loading={sending}>
                                Create Notification
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Past Notifications */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Notifications</h2>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Date</th>
                                        <th>Delivery Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        [...Array(3)].map((_, i) => (
                                            <tr key={i}>
                                                <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-20 h-4 skeleton rounded"></div></td>
                                            </tr>
                                        ))
                                    ) : notifications.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-gray-500">
                                                No notifications sent yet
                                            </td>
                                        </tr>
                                    ) : (
                                        notifications.map((notification) => (
                                            <tr key={notification.id}>
                                                <td>{getTypeBadge(notification.notification_type)}</td>
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
