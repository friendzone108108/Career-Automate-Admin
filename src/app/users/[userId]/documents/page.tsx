'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createAdminServiceClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { ChevronRight, ExternalLink, FileText } from 'lucide-react';

// Frontend Supabase storage URL
const FRONTEND_SUPABASE_URL = process.env.NEXT_PUBLIC_FRONTEND_SUPABASE_URL || 'https://sapmqweflhqfprkjoikk.supabase.co';

// Helper function to get the full storage URL
const getStorageUrl = (fileUrl: string | null): string | null => {
    if (!fileUrl) return null;
    // If it's already a full URL, return as-is
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        return fileUrl;
    }
    // Otherwise, construct the storage URL
    return `${FRONTEND_SUPABASE_URL}/storage/v1/object/public/documents/${fileUrl}`;
};

interface DocumentItem {
    id: string;
    document_type: string;
    upload_date: string;
    file_url: string | null;
    source_table: string;
    status: 'pending' | 'approved' | 'rejected';
    ocr_extracted: boolean;
}

interface UserInfo {
    full_name: string;
    email: string;
}

export default function UserDocumentsPage() {
    const params = useParams();
    const router = useRouter();
    const { adminUser } = useAuth();
    const userId = params.userId as string;

    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

    useEffect(() => {
        if (userId) {
            fetchUserAndDocuments();
        }
    }, [userId]);

    const fetchUserAndDocuments = async () => {
        setLoading(true);
        try {
            // Use API route instead of direct client calls (service client only works server-side)
            const response = await fetch(`/api/users/${userId}/documents`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch documents');
            }

            setDocuments(data.documents || []);
            setUserInfo(data.userInfo || null);
        } catch (error) {
            console.error('Error fetching documents:', error);
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (docId: string, docType: string, sourceTable: string) => {
        try {
            const adminClient = createAdminServiceClient();

            await adminClient.from('document_verifications').upsert({
                user_id: userId,
                document_id: docId,
                document_type: docType,
                document_table: sourceTable,
                status: 'approved',
                verified_by: adminUser?.id,
                verified_at: new Date().toISOString()
            }, { onConflict: 'document_id' });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'approve_document',
                action_description: `Approved ${docType} for user`,
                target_user_id: userId,
                target_user_email: userInfo?.email
            });

            toast.success(`${docType} approved`);
            fetchUserAndDocuments();
        } catch (error) {
            console.error('Error approving document:', error);
            toast.error('Failed to approve document');
        }
    };

    const handleReject = async (docId: string, docType: string, sourceTable: string) => {
        if (!rejectionNotes.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }

        try {
            const adminClient = createAdminServiceClient();

            await adminClient.from('document_verifications').upsert({
                user_id: userId,
                document_id: docId,
                document_type: docType,
                document_table: sourceTable,
                status: 'rejected',
                rejection_reason: rejectionNotes,
                verified_by: adminUser?.id,
                verified_at: new Date().toISOString()
            }, { onConflict: 'document_id' });

            // Log the action
            await adminClient.from('activity_logs').insert({
                admin_id: adminUser?.id,
                admin_email: adminUser?.email,
                action_type: 'reject_document',
                action_description: `Rejected ${docType} for user. Reason: ${rejectionNotes}`,
                target_user_id: userId,
                target_user_email: userInfo?.email
            });

            toast.success(`${docType} rejected`);
            setRejectionNotes('');
            fetchUserAndDocuments();
        } catch (error) {
            console.error('Error rejecting document:', error);
            toast.error('Failed to reject document');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge variant="success">Approved</Badge>;
            case 'rejected':
                return <Badge variant="danger">Rejected</Badge>;
            default:
                return <Badge variant="warning">Pending</Badge>;
        }
    };

    const handleBulkAction = async (action: 'approve' | 'reject') => {
        if (selectedDocs.length === 0) {
            toast.error('Please select documents first');
            return;
        }

        if (action === 'reject' && !rejectionNotes.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }

        for (const docId of selectedDocs) {
            const doc = documents.find(d => d.id === docId);
            if (doc) {
                if (action === 'approve') {
                    await handleApprove(doc.id, doc.document_type, doc.source_table);
                } else {
                    await handleReject(doc.id, doc.document_type, doc.source_table);
                }
            }
        }

        setSelectedDocs([]);
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Link href="/users" className="hover:text-blue-600">User Management</Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-gray-900">User Documents</span>
                </div>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">User Documents</h1>
                    <p className="text-gray-500 mt-1">
                        Resumes, Profile Photo & Government ID{userInfo ? ` for ${userInfo.full_name}` : ''}.
                    </p>
                </div>

                {/* Documents Table */}
                <Card className="mb-6">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document Type</th>
                                    <th>Upload Date</th>
                                    <th>OCR Extract</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i}>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-24 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-16 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-16 h-4 skeleton rounded"></div></td>
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                        </tr>
                                    ))
                                ) : documents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-500">
                                            No documents found for this user
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((doc) => (
                                        <tr key={doc.id}>
                                            <td className="font-medium text-gray-900">{doc.document_type}</td>
                                            <td className="text-gray-600">{formatDate(doc.upload_date)}</td>
                                            <td>
                                                <span className="text-gray-500">
                                                    {doc.ocr_extracted ? 'Extracted' : 'Extracted'}
                                                </span>
                                            </td>
                                            <td>{getStatusBadge(doc.status)}</td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleApprove(doc.id, doc.document_type, doc.source_table)}
                                                        className="text-green-600 hover:text-green-700 font-medium text-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!rejectionNotes.trim()) {
                                                                toast.error('Please provide rejection notes below first');
                                                                return;
                                                            }
                                                            handleReject(doc.id, doc.document_type, doc.source_table);
                                                        }}
                                                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                                                    >
                                                        Reject
                                                    </button>
                                                    {doc.file_url && (
                                                        <a
                                                            href={getStorageUrl(doc.file_url) || '#'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                                                        >
                                                            View
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Rejection Notes */}
                <Card>
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-gray-900 mb-3">Rejection Notes</h3>
                        <textarea
                            value={rejectionNotes}
                            onChange={(e) => setRejectionNotes(e.target.value)}
                            placeholder="Provide a reason for rejection..."
                            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <Button
                                variant="danger"
                                onClick={() => handleBulkAction('reject')}
                                disabled={selectedDocs.length === 0 && documents.filter(d => d.status === 'pending').length === 0}
                            >
                                Reject
                            </Button>
                            <Button
                                onClick={() => handleBulkAction('approve')}
                                disabled={selectedDocs.length === 0 && documents.filter(d => d.status === 'pending').length === 0}
                            >
                                Approve
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
