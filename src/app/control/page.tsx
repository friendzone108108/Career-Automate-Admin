'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
    Search,
    AlertTriangle,
    User
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createAdminServiceClient, createFrontendServiceClient } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ActivityLog {
    id: string;
    action_type: string;
    action_description: string;
    target_user_email: string | null;
    admin_email: string | null;
    created_at: string;
}

interface SelectedUser {
    id: string;
    email: string;
    full_name: string;
    automation_paused: boolean;
    automation_stopped: boolean;
}

export default function ControlPage() {
    const { adminUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [emergencyStopActive, setEmergencyStopActive] = useState(false);

    useEffect(() => {
        fetchActivityLogs();
        fetchEmergencyStopStatus();
    }, []);

    const fetchEmergencyStopStatus = async () => {
        try {
            const adminClient = createAdminServiceClient();
            const { data } = await adminClient
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'emergency_stop')
                .single();

            setEmergencyStopActive(data?.setting_value === 'true');
        } catch (error) {
            console.error('Error fetching emergency stop status:', error);
        }
    };

    const fetchActivityLogs = async () => {
        try {
            const adminClient = createAdminServiceClient();
            const { data, error } = await adminClient
                .from('activity_logs')
                .select('*')
                .in('action_type', ['pause_automation', 'resume_automation', 'stop_automation', 'emergency_stop', 'login', 'logout'])
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setActivityLogs(data || []);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            const frontendClient = createFrontendServiceClient();
            const adminClient = createAdminServiceClient();

            // Search users by name or email
            const { data: profiles } = await frontendClient
                .from('profiles')
                .select('id, full_name')
                .ilike('full_name', `%${searchQuery}%`)
                .limit(5);

            const { data: users } = await frontendClient
                .from('users')
                .select('id, email')
                .ilike('email', `%${searchQuery}%`)
                .limit(5);

            // Combine results
            const results: any[] = [];

            profiles?.forEach(p => {
                const user = users?.find(u => u.id === p.id);
                if (user || p) {
                    results.push({
                        id: p.id,
                        full_name: p.full_name || 'Unknown',
                        email: user?.email || 'Unknown'
                    });
                }
            });

            users?.forEach(u => {
                if (!results.find(r => r.id === u.id)) {
                    const profile = profiles?.find(p => p.id === u.id);
                    results.push({
                        id: u.id,
                        full_name: profile?.full_name || 'Unknown',
                        email: u.email
                    });
                }
            });

            setSearchResults(results);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectUser = async (user: any) => {
        try {
            const adminClient = createAdminServiceClient();

            const { data: status } = await adminClient
                .from('user_automation_status')
                .select('*')
                .eq('user_id', user.id)
                .single();

            setSelectedUser({
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                automation_paused: status?.automation_paused || false,
                automation_stopped: status?.automation_stopped || false
            });

            setSearchResults([]);
            setSearchQuery('');
        } catch (error) {
            // User might not have automation status yet
            setSelectedUser({
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                automation_paused: false,
                automation_stopped: false
            });
            setSearchResults([]);
            setSearchQuery('');
        }
    };

    const handleAutomationControl = async (action: 'pause' | 'resume' | 'stop') => {
        if (!selectedUser) return;

        try {
            const adminClient = createAdminServiceClient();

            const updates: any = {
                user_id: selectedUser.id,
                user_email: selectedUser.email,
                user_name: selectedUser.full_name
            };

            if (action === 'pause') {
                updates.automation_paused = true;
                updates.paused_at = new Date().toISOString();
                updates.paused_by = adminUser?.id;
            } else if (action === 'resume') {
                updates.automation_paused = false;
                updates.paused_at = null;
            } else if (action === 'stop') {
                updates.automation_stopped = true;
                updates.automation_paused = false;
                updates.stopped_at = new Date().toISOString();
                updates.stopped_by = adminUser?.id;
            }

            await adminClient
                .from('user_automation_status')
                .upsert(updates, { onConflict: 'user_id' });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: `${action}_automation`,
                action_description: `Automation ${action}d for user: ${selectedUser.full_name}`,
                target_user_id: selectedUser.id,
                target_user_email: selectedUser.email
            });

            toast.success(`Automation ${action}d for ${selectedUser.full_name}`);

            // Update local state
            setSelectedUser({
                ...selectedUser,
                automation_paused: action === 'pause',
                automation_stopped: action === 'stop'
            });

            fetchActivityLogs();
        } catch (error) {
            console.error('Error updating automation status:', error);
            toast.error('Failed to update automation status');
        }
    };

    const handleEmergencyStop = async () => {
        const newStatus = !emergencyStopActive;

        if (newStatus && !confirm('Are you sure you want to activate EMERGENCY STOP? This will halt all automation processes across all users.')) {
            return;
        }

        try {
            const adminClient = createAdminServiceClient();

            await adminClient
                .from('system_settings')
                .update({
                    setting_value: newStatus.toString(),
                    updated_by: adminUser?.id
                })
                .eq('setting_key', 'emergency_stop');

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'emergency_stop',
                action_description: newStatus ? 'Emergency stop activated' : 'Emergency stop deactivated'
            });

            setEmergencyStopActive(newStatus);
            toast.success(newStatus ? 'Emergency stop activated' : 'Emergency stop deactivated');
            fetchActivityLogs();
        } catch (error) {
            console.error('Error toggling emergency stop:', error);
            toast.error('Failed to toggle emergency stop');
        }
    };

    const getActivityUser = (log: ActivityLog) => {
        if (log.target_user_email) return log.target_user_email;
        if (log.action_type === 'emergency_stop') return 'System';
        return log.admin_email || 'Unknown';
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Control Mechanism</h1>
                    <p className="text-gray-500 mt-1">
                        Manage and monitor your automation settings for all users.
                    </p>
                </div>

                {/* User Search */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search user by name or email"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (e.target.value.length > 2) handleSearch();
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />

                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-2">
                                    {searchResults.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => selectUser(user)}
                                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                <User className="w-4 h-4 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{user.full_name}</p>
                                                <p className="text-sm text-gray-500">{user.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected User Controls */}
                        {selectedUser && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm text-blue-600 mb-4">
                                    Controlling: <span className="font-medium">{selectedUser.full_name}</span> ({selectedUser.email})
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Automation Controls */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation Controls</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div>
                                    <p className="font-medium text-gray-900">Pause Automation</p>
                                    <p className="text-sm text-gray-500">Pause all automation for the selected user.</p>
                                </div>
                                <Switch
                                    checked={selectedUser?.automation_paused || false}
                                    onChange={(checked) => handleAutomationControl(checked ? 'pause' : 'resume')}
                                    disabled={!selectedUser || selectedUser.automation_stopped}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div>
                                    <p className="font-medium text-gray-900">Resume Automation</p>
                                    <p className="text-sm text-gray-500">Resume all automation for the selected user.</p>
                                </div>
                                <Switch
                                    checked={selectedUser ? !selectedUser.automation_paused && !selectedUser.automation_stopped : false}
                                    onChange={() => handleAutomationControl('resume')}
                                    disabled={!selectedUser || !selectedUser.automation_paused}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-medium text-gray-900">Stop All Automation</p>
                                    <p className="text-sm text-gray-500">Permanently stop all automation for the selected user.</p>
                                </div>
                                <Switch
                                    checked={selectedUser?.automation_stopped || false}
                                    onChange={() => handleAutomationControl('stop')}
                                    disabled={!selectedUser}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Global Controls */}
                <Card className="mb-6 border-red-200">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-red-600">Global Controls</h2>
                                <div className="mt-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">Emergency Stop</p>
                                            <p className="text-sm text-gray-500">
                                                Immediately halt all automation processes across all users.
                                            </p>
                                        </div>
                                        <Button
                                            variant={emergencyStopActive ? 'secondary' : 'danger'}
                                            onClick={handleEmergencyStop}
                                        >
                                            {emergencyStopActive ? 'Deactivate Stop' : 'Activate Stop'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Activity Log */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h2>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Activity</th>
                                        <th>User</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-gray-500">
                                                No activity logs yet
                                            </td>
                                        </tr>
                                    ) : (
                                        activityLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td className="text-blue-600">{formatDateTime(log.created_at)}</td>
                                                <td className={log.action_type === 'emergency_stop' ? 'font-semibold' : ''}>
                                                    {log.action_description}
                                                </td>
                                                <td>
                                                    <span className="text-blue-600 hover:underline cursor-pointer">
                                                        {getActivityUser(log)}
                                                    </span>
                                                </td>
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
