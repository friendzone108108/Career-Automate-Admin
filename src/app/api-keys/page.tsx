'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Plus,
    AlertTriangle,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createAdminServiceClient } from '@/lib/supabase';
import { getExpiryStatus, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ApiKey {
    id: string;
    api_name: string;
    variable_name: string;
    api_key_value: string;
    expiry_date: string | null;
    is_active: boolean;
    created_at: string;
}

export default function ApiKeysPage() {
    const { adminUser } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingKey, setEditingKey] = useState<ApiKey | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        api_name: '',
        variable_name: '',
        api_key_value: '',
        expiry_date: ''
    });

    useEffect(() => {
        fetchApiKeys();
    }, []);

    const fetchApiKeys = async () => {
        try {
            const adminClient = createAdminServiceClient();

            const { data, error } = await adminClient
                .from('api_keys')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setApiKeys(data || []);
        } catch (error) {
            console.error('Error fetching API keys:', error);
            toast.error('Failed to load API keys');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.api_name || !formData.variable_name || !formData.api_key_value) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const adminClient = createAdminServiceClient();

            if (editingKey) {
                // Update existing key
                await adminClient
                    .from('api_keys')
                    .update({
                        api_name: formData.api_name,
                        variable_name: formData.variable_name,
                        api_key_value: formData.api_key_value,
                        expiry_date: formData.expiry_date || null
                    })
                    .eq('id', editingKey.id);

                // Log the action
                await adminClient.from('activity_logs').insert({
                    admin_id: adminUser?.id,
                    admin_email: adminUser?.email,
                    action_type: 'update_api_key',
                    action_description: `Updated API key: ${formData.api_name}`,
                    metadata: { key_name: formData.api_name }
                });

                toast.success('API key updated successfully');
            } else {
                // Create new key
                await adminClient
                    .from('api_keys')
                    .insert({
                        api_name: formData.api_name,
                        variable_name: formData.variable_name,
                        api_key_value: formData.api_key_value,
                        expiry_date: formData.expiry_date || null,
                        created_by: adminUser?.id
                    });

                // Log the action
                await adminClient.from('activity_logs').insert({
                    admin_id: adminUser?.id,
                    admin_email: adminUser?.email,
                    action_type: 'add_api_key',
                    action_description: `Added new API key: ${formData.api_name}`,
                    metadata: { key_name: formData.api_name }
                });

                toast.success('API key added successfully');
            }

            setShowAddModal(false);
            setEditingKey(null);
            setFormData({ api_name: '', variable_name: '', api_key_value: '', expiry_date: '' });
            fetchApiKeys();
        } catch (error) {
            console.error('Error saving API key:', error);
            toast.error('Failed to save API key');
        }
    };

    const handleEdit = (key: ApiKey) => {
        setEditingKey(key);
        setFormData({
            api_name: key.api_name,
            variable_name: key.variable_name,
            api_key_value: key.api_key_value,
            expiry_date: key.expiry_date ? key.expiry_date.split('T')[0] : ''
        });
        setShowAddModal(true);
    };

    const handleUpdateKey = async (keyId: string) => {
        const newKeyValue = prompt('Enter new API key value:');
        if (!newKeyValue) return;

        try {
            const adminClient = createAdminServiceClient();

            await adminClient
                .from('api_keys')
                .update({ api_key_value: newKeyValue })
                .eq('id', keyId);

            const key = apiKeys.find(k => k.id === keyId);

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'update_api_key',
                action_description: `Updated key value for: ${key?.api_name}`,
                metadata: { key_name: key?.api_name }
            });

            toast.success('API key value updated');
            fetchApiKeys();
        } catch (error) {
            console.error('Error updating API key:', error);
            toast.error('Failed to update API key');
        }
    };

    const handleDelete = async (keyId: string, keyName: string) => {
        if (!confirm(`Are you sure you want to delete "${keyName}"?`)) return;

        try {
            const adminClient = createAdminServiceClient();

            await adminClient
                .from('api_keys')
                .delete()
                .eq('id', keyId);

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'delete_api_key',
                action_description: `Deleted API key: ${keyName}`,
                metadata: { key_name: keyName }
            });

            toast.success('API key deleted');
            fetchApiKeys();
        } catch (error) {
            console.error('Error deleting API key:', error);
            toast.error('Failed to delete API key');
        }
    };

    const maskKey = (key: string) => {
        if (key.length <= 8) return '••••••••';
        return '••••••••••••••••';
    };

    const getExpiryBadge = (expiryDate: string | null) => {
        const status = getExpiryStatus(expiryDate);
        const variant = status.variant === 'danger' ? 'danger' : status.variant === 'warning' ? 'warning' : 'default';
        return (
            <span className="flex items-center gap-1">
                {status.variant === 'danger' && <AlertTriangle className="w-3 h-3" />}
                <Badge variant={variant}>{status.text}</Badge>
            </span>
        );
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">API Key Management</h1>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Regularly update your third-party API keys to ensure seamless integration and security.
                        </p>
                    </div>
                    <Button onClick={() => setShowAddModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Key
                    </Button>
                </div>

                {/* API Keys Table */}
                <Card>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>API Name</th>
                                    <th>Variable Name</th>
                                    <th>Current Key</th>
                                    <th>Expiry</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [...Array(3)].map((_, i) => (
                                        <tr key={i}>
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                        </tr>
                                    ))
                                ) : apiKeys.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-500">
                                            No API keys configured. Click "Add New Key" to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    apiKeys.map((key) => (
                                        <tr key={key.id}>
                                            <td className="font-medium text-gray-900">{key.api_name}</td>
                                            <td>
                                                <code className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                                    {key.variable_name}
                                                </code>
                                            </td>
                                            <td className="text-gray-500 font-mono text-sm">
                                                {maskKey(key.api_key_value)}
                                            </td>
                                            <td>{getExpiryBadge(key.expiry_date)}</td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleEdit(key)}
                                                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateKey(key.id)}
                                                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                                                    >
                                                        Update Key
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(key.id, key.api_name)}
                                                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Add/Edit Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-slide-up">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {editingKey ? 'Edit API Key' : 'Add New API Key'}
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setEditingKey(null);
                                        setFormData({ api_name: '', variable_name: '', api_key_value: '', expiry_date: '' });
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="API Name"
                                    placeholder="e.g., Job Posting API"
                                    value={formData.api_name}
                                    onChange={(e) => setFormData({ ...formData, api_name: e.target.value })}
                                    required
                                />

                                <Input
                                    label="Variable Name"
                                    placeholder="e.g., JOB_POST_API_KEY"
                                    value={formData.variable_name}
                                    onChange={(e) => setFormData({ ...formData, variable_name: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                    required
                                />

                                <Input
                                    label="API Key Value"
                                    type="password"
                                    placeholder="Enter the API key"
                                    value={formData.api_key_value}
                                    onChange={(e) => setFormData({ ...formData, api_key_value: e.target.value })}
                                    required
                                />

                                <Input
                                    label="Expiry Date (Optional)"
                                    type="date"
                                    value={formData.expiry_date}
                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                />

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setEditingKey(null);
                                            setFormData({ api_name: '', variable_name: '', api_key_value: '', expiry_date: '' });
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        {editingKey ? 'Update' : 'Add'} Key
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
