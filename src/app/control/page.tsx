'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    AlertTriangle,
    ShieldAlert,
    Power,
    AlertOctagon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createAdminServiceClient } from '@/lib/supabase';
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

export default function ControlPage() {
    const { adminUser } = useAuth();
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [emergencyStopActive, setEmergencyStopActive] = useState(false);
    const [allAutomationsStopped, setAllAutomationsStopped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activatingEmergencyStop, setActivatingEmergencyStop] = useState(false);
    const [stoppingAllAutomations, setStoppingAllAutomations] = useState(false);

    useEffect(() => {
        fetchSystemStatus();
        fetchActivityLogs();
    }, []);

    const fetchSystemStatus = async () => {
        try {
            const adminClient = createAdminServiceClient();

            // Fetch emergency stop status
            const { data: emergencyData } = await adminClient
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'emergency_stop')
                .single();

            setEmergencyStopActive(emergencyData?.setting_value === 'true');

            // Fetch all automations stopped status
            const { data: allStoppedData } = await adminClient
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'all_automations_stopped')
                .single();

            setAllAutomationsStopped(allStoppedData?.setting_value === 'true');
        } catch (error) {
            console.error('Error fetching system status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivityLogs = async () => {
        try {
            const adminClient = createAdminServiceClient();
            const { data, error } = await adminClient
                .from('activity_logs')
                .select('*')
                .in('action_type', ['emergency_stop', 'stop_all_automations', 'login', 'logout'])
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setActivityLogs(data || []);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        }
    };

    const handleEmergencyStop = async () => {
        const newStatus = !emergencyStopActive;

        if (newStatus && !confirm('⚠️ EMERGENCY STOP\n\nThis will immediately halt ALL automation processes for ALL users.\n\nAre you sure you want to proceed?')) {
            return;
        }

        setActivatingEmergencyStop(true);
        try {
            const adminClient = createAdminServiceClient();

            // Upsert the setting
            await adminClient
                .from('system_settings')
                .upsert({
                    setting_key: 'emergency_stop',
                    setting_value: newStatus.toString(),
                    updated_by: adminUser?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'setting_key' });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'emergency_stop',
                action_description: newStatus ? '🚨 Emergency stop ACTIVATED - All automations halted' : '✅ Emergency stop DEACTIVATED - Automations can resume'
            });

            setEmergencyStopActive(newStatus);
            toast.success(newStatus ? 'Emergency stop activated!' : 'Emergency stop deactivated');
            fetchActivityLogs();
        } catch (error) {
            console.error('Error toggling emergency stop:', error);
            toast.error('Failed to toggle emergency stop');
        } finally {
            setActivatingEmergencyStop(false);
        }
    };

    const handleStopAllAutomations = async () => {
        const newStatus = !allAutomationsStopped;

        if (newStatus && !confirm('⛔ STOP ALL AUTOMATIONS\n\nThis will permanently stop all automation processes.\nUsers will see a "Service Unavailable" message.\n\nAre you sure you want to proceed?')) {
            return;
        }

        setStoppingAllAutomations(true);
        try {
            const adminClient = createAdminServiceClient();

            // Upsert the setting
            await adminClient
                .from('system_settings')
                .upsert({
                    setting_key: 'all_automations_stopped',
                    setting_value: newStatus.toString(),
                    updated_by: adminUser?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'setting_key' });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'stop_all_automations',
                action_description: newStatus ? '⛔ All automations STOPPED - Users cannot access automation features' : '✅ All automations RESUMED - Users can access automation features'
            });

            setAllAutomationsStopped(newStatus);
            toast.success(newStatus ? 'All automations stopped!' : 'All automations resumed');
            fetchActivityLogs();
        } catch (error) {
            console.error('Error stopping all automations:', error);
            toast.error('Failed to stop all automations');
        } finally {
            setStoppingAllAutomations(false);
        }
    };

    const getActivityIcon = (actionType: string) => {
        if (actionType === 'emergency_stop') return '🚨';
        if (actionType === 'stop_all_automations') return '⛔';
        return '📝';
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <ShieldAlert className="w-6 h-6 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Control Mechanism</h1>
                    </div>
                    <p className="text-gray-500">
                        Emergency controls to halt automation processes across the platform.
                    </p>
                </div>

                {/* Status Banner */}
                {(emergencyStopActive || allAutomationsStopped) && (
                    <div className={`mb-6 p-4 rounded-lg border-2 ${emergencyStopActive ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'}`}>
                        <div className="flex items-center gap-3">
                            <AlertOctagon className={`w-6 h-6 ${emergencyStopActive ? 'text-red-600' : 'text-orange-600'}`} />
                            <div>
                                <p className={`font-semibold ${emergencyStopActive ? 'text-red-800' : 'text-orange-800'}`}>
                                    {emergencyStopActive ? 'EMERGENCY STOP ACTIVE' : 'ALL AUTOMATIONS STOPPED'}
                                </p>
                                <p className={`text-sm ${emergencyStopActive ? 'text-red-600' : 'text-orange-600'}`}>
                                    {emergencyStopActive
                                        ? 'All automation processes are currently halted.'
                                        : 'Users cannot access automation features.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Control Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Emergency Stop */}
                    <Card className={`border-2 ${emergencyStopActive ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${emergencyStopActive ? 'bg-red-200' : 'bg-red-100'}`}>
                                    <AlertTriangle className="w-8 h-8 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Emergency Stop</h3>
                                    <p className="text-sm text-gray-500 mt-1 mb-4">
                                        Immediately halt all automation processes across all users. Use this for critical situations.
                                    </p>
                                    <Button
                                        variant={emergencyStopActive ? 'secondary' : 'danger'}
                                        onClick={handleEmergencyStop}
                                        loading={activatingEmergencyStop}
                                        className="w-full"
                                    >
                                        {emergencyStopActive ? (
                                            <>
                                                <Power className="w-4 h-4 mr-2" />
                                                Deactivate Emergency Stop
                                            </>
                                        ) : (
                                            <>
                                                <AlertTriangle className="w-4 h-4 mr-2" />
                                                Activate Emergency Stop
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stop All Automations */}
                    <Card className={`border-2 ${allAutomationsStopped ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${allAutomationsStopped ? 'bg-orange-200' : 'bg-orange-100'}`}>
                                    <Power className="w-8 h-8 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Stop All Automations</h3>
                                    <p className="text-sm text-gray-500 mt-1 mb-4">
                                        Disable all automation features. Users will see a maintenance message when trying to access these features.
                                    </p>
                                    <Button
                                        variant={allAutomationsStopped ? 'secondary' : 'danger'}
                                        onClick={handleStopAllAutomations}
                                        loading={stoppingAllAutomations}
                                        className="w-full"
                                    >
                                        {allAutomationsStopped ? (
                                            <>
                                                <Power className="w-4 h-4 mr-2" />
                                                Resume All Automations
                                            </>
                                        ) : (
                                            <>
                                                <Power className="w-4 h-4 mr-2" />
                                                Stop All Automations
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Activity Log */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Control Activity Log</h2>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Activity</th>
                                        <th>Admin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        [...Array(3)].map((_, i) => (
                                            <tr key={i}>
                                                <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-48 h-4 skeleton rounded"></div></td>
                                                <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                            </tr>
                                        ))
                                    ) : activityLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-gray-500">
                                                No control activity yet
                                            </td>
                                        </tr>
                                    ) : (
                                        activityLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td className="text-blue-600 whitespace-nowrap">
                                                    {formatDateTime(log.created_at)}
                                                </td>
                                                <td className={log.action_type.includes('stop') ? 'font-medium' : ''}>
                                                    {getActivityIcon(log.action_type)} {log.action_description}
                                                </td>
                                                <td className="text-gray-600">
                                                    {log.admin_email || 'System'}
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
