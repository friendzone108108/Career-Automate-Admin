'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Check, X, Eye, Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useParams } from 'next/navigation';

interface Certificate {
    id: string;
    document_name: string;
    document_type: string;
    file_url: string;
    file_name: string;
    file_size: number | null;
    verification_status: 'pending' | 'approved' | 'rejected';
    rejection_reason: string | null;
    created_at: string;
}

interface UserProfile {
    full_name: string;
    email?: string;
}

export default function ManageCertificatesPage() {
    const { adminUser } = useAuth();
    const params = useParams();
    const userId = params.userId as string;

    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedCertId, setSelectedCertId] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            fetchUserProfile();
            fetchCertificates();
        }
    }, [userId]);

    const fetchUserProfile = async () => {
        try {
            const { data, error } = await adminSupabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();

            if (error) throw error;

            // Fetch email from auth.users
            const { data: authData } = await adminSupabase.auth.admin.getUserById(userId);

            setUserProfile({
                full_name: data?.full_name || 'Unknown User',
                email: authData?.user?.email
            });
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    const fetchCertificates = async () => {
        setLoading(true);
        try {
            const { data, error } = await adminSupabase
                .from('certificate_documents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCertificates(data || []);
        } catch (error) {
            console.error('Error fetching certificates:', error);
            toast.error('Failed to load certificates');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (certId: string) => {
        try {
            const { error } = await adminSupabase
                .from('certificate_documents')
                .update({
                    verification_status: 'approved',
                    verified_by: adminUser?.id,
                    verified_at: new Date().toISOString(),
                    rejection_reason: null
                })
                .eq('id', certId);

            if (error) throw error;

            // Log the action
            await adminSupabase.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'approve_certificate',
                action_description: `Approved certificate for user ${userId}`,
                target_user_id: userId
            });

            toast.success('Certificate approved successfully');
            fetchCertificates();
        } catch (error) {
            console.error('Error approving certificate:', error);
            toast.error('Failed to approve certificate');
        }
    };

    const openRejectModal = (certId: string) => {
        setSelectedCertId(certId);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const handleReject = async () => {
        if (!selectedCertId) return;

        try {
            const { error } = await adminSupabase
                .from('certificate_documents')
                .update({
                    verification_status: 'rejected',
                    verified_by: adminUser?.id,
                    verified_at: new Date().toISOString(),
                    rejection_reason: rejectionReason || 'No reason provided'
                })
                .eq('id', selectedCertId);

            if (error) throw error;

            // Log the action
            await adminSupabase.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'reject_certificate',
                action_description: `Rejected certificate for user ${userId}: ${rejectionReason}`,
                target_user_id: userId
            });

            toast.success('Certificate rejected');
            setShowRejectModal(false);
            setSelectedCertId(null);
            fetchCertificates();
        } catch (error) {
            console.error('Error rejecting certificate:', error);
            toast.error('Failed to reject certificate');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge variant="success">✓ Approved</Badge>;
            case 'rejected':
                return <Badge variant="danger">✗ Rejected</Badge>;
            default:
                return <Badge variant="warning">⏳ Pending</Badge>;
        }
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'Unknown';
        const mb = bytes / 1048576;
        return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/users"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Manage Certificates</h1>
                            {userProfile && (
                                <p className="text-gray-500">
                                    {userProfile.full_name} {userProfile.email && `(${userProfile.email})`}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Certificates List */}
                <div className="space-y-4">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-2">
                                            <div className="w-48 h-5 skeleton rounded"></div>
                                            <div className="w-32 h-4 skeleton rounded"></div>
                                        </div>
                                        <div className="w-24 h-8 skeleton rounded"></div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : certificates.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500">No certificates uploaded by this user</p>
                            </CardContent>
                        </Card>
                    ) : (
                        certificates.map((cert) => (
                            <Card key={cert.id}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="default">{cert.document_type}</Badge>
                                                {getStatusBadge(cert.verification_status)}
                                            </div>
                                            <h3 className="font-semibold text-lg">{cert.document_name}</h3>
                                            <p className="text-sm text-gray-500">
                                                {cert.file_name} • {formatFileSize(cert.file_size)} • Uploaded {new Date(cert.created_at).toLocaleDateString()}
                                            </p>
                                            {cert.rejection_reason && (
                                                <p className="text-sm text-red-600 mt-1">
                                                    Rejection reason: {cert.rejection_reason}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={cert.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="View Document"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </a>
                                            <a
                                                href={cert.file_url}
                                                download
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-5 h-5" />
                                            </a>
                                            {cert.verification_status !== 'approved' && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleApprove(cert.id)}
                                                    className="text-green-600 hover:bg-green-50"
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Approve
                                                </Button>
                                            )}
                                            {cert.verification_status !== 'rejected' && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => openRejectModal(cert.id)}
                                                    className="text-red-600 hover:bg-red-50"
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Reject
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Reject Certificate</h3>
                        <p className="text-gray-600 mb-4">
                            Please provide a reason for rejecting this certificate:
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="e.g., Document is blurry, wrong document type, etc."
                            className="w-full border border-gray-300 rounded-lg p-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <Button
                                variant="secondary"
                                onClick={() => setShowRejectModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleReject}
                            >
                                Reject Certificate
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
