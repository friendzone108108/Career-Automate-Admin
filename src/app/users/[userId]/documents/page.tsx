'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { ChevronRight, ExternalLink, FileText, Loader2 } from 'lucide-react';

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
    const [processingDoc, setProcessingDoc] = useState<string | null>(null);

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

    const handleAction = async (docId: string, docType: string, sourceTable: string, action: 'approve' | 'reject') => {
        setProcessingDoc(docId);
        try {
            const response = await fetch(`/api/users/${userId}/documents/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: docId,
                    documentType: docType,
                    sourceTable: sourceTable,
                    action: action,
                    adminId: adminUser?.id,
                    adminEmail: adminUser?.email,
                    userEmail: userInfo?.email
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Failed to ${action} document`);
            }

            toast.success(`${docType} ${action === 'approve' ? 'approved' : 'rejected'}`);
            fetchUserAndDocuments();
        } catch (error: any) {
            console.error(`Error ${action}ing document:`, error);
            toast.error(error.message || `Failed to ${action} document`);
        } finally {
            setProcessingDoc(null);
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
                <Card>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document Type</th>
                                    <th>Upload Date</th>
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
                                            <td><div className="w-32 h-4 skeleton rounded"></div></td>
                                        </tr>
                                    ))
                                ) : documents.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-500">
                                            No documents found for this user
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((doc) => (
                                        <tr key={doc.id}>
                                            <td className="font-medium text-gray-900">{doc.document_type}</td>
                                            <td className="text-gray-600">{formatDate(doc.upload_date)}</td>
                                            <td>{getStatusBadge(doc.status)}</td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleAction(doc.id, doc.document_type, doc.source_table, 'approve')}
                                                        disabled={processingDoc === doc.id || doc.status === 'approved'}
                                                        className="text-green-600 hover:text-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                    >
                                                        {processingDoc === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(doc.id, doc.document_type, doc.source_table, 'reject')}
                                                        disabled={processingDoc === doc.id || doc.status === 'rejected'}
                                                        className="text-red-600 hover:text-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                    >
                                                        {processingDoc === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
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
            </div>
        </AdminLayout>
    );
}
