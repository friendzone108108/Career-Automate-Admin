'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { createAdminServiceClient, adminSupabase } from '@/lib/supabase';
import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronRight, User } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const { adminUser, refreshAdminUser } = useAuth();

    // Profile form state
    const [firstName, setFirstName] = useState(adminUser?.first_name || '');
    const [lastName, setLastName] = useState(adminUser?.last_name || '');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const getPasswordStrength = (password: string) => {
        if (!password) return { strength: 0, label: '' };

        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 2) return { strength: 33, label: 'Weak', color: 'bg-red-500' };
        if (score <= 4) return { strength: 66, label: 'Medium', color: 'bg-yellow-500' };
        return { strength: 100, label: 'Strong', color: 'bg-green-500' };
    };

    const passwordStrength = getPasswordStrength(newPassword);

    const handleSaveProfile = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            toast.error('Please enter both first and last name');
            return;
        }

        setSavingProfile(true);
        try {
            const adminClient = createAdminServiceClient();

            await adminClient
                .from('admin_users')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`
                })
                .eq('id', adminUser?.id);

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'update_profile',
                action_description: 'Updated profile information'
            });

            toast.success('Profile updated successfully');
            refreshAdminUser();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('Please fill in all password fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setChangingPassword(true);
        try {
            // First verify current password by signing in
            const { error: signInError } = await adminSupabase.auth.signInWithPassword({
                email: adminUser?.email || '',
                password: currentPassword
            });

            if (signInError) {
                toast.error('Current password is incorrect');
                setChangingPassword(false);
                return;
            }

            // Update password
            const { error: updateError } = await adminSupabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            // Log the action
            const adminClient = createAdminServiceClient();
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'change_password',
                action_description: 'Changed password'
            });

            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Error changing password:', error);
            toast.error('Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in max-w-3xl">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Link href="/dashboard" className="hover:text-blue-600">Home</Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-gray-900">Settings</span>
                </div>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
                    <p className="text-gray-500 mt-1">
                        Manage your profile and security settings
                    </p>
                </div>

                {/* Profile Information */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>

                        {/* Profile Display */}
                        <div className="flex items-center gap-6 mb-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">
                                    {adminUser?.first_name?.[0] || adminUser?.email?.[0]?.toUpperCase() || 'A'}
                                </span>
                            </div>

                            <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-lg">
                                    {adminUser?.full_name || `${firstName} ${lastName}` || 'Admin User'}
                                </p>
                                <p className="text-gray-500">{adminUser?.email}</p>
                            </div>
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Input
                                label="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Enter first name"
                            />
                            <Input
                                label="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Enter last name"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveProfile} loading={savingProfile}>
                                Save Changes
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Password & Security */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-6">Password & Security</h2>

                        <div className="space-y-4">
                            <Input
                                label="Current Password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter your current password"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Input
                                        label="New Password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter a new password"
                                    />
                                    {newPassword && (
                                        <div className="mt-2">
                                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                                                    style={{ width: `${passwordStrength.strength}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Password strength: {passwordStrength.label}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <Input
                                    label="Confirm New Password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your new password"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <Button onClick={handleChangePassword} loading={changingPassword}>
                                Change Password
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
