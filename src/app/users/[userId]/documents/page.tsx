'use client';

import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createFrontendServiceClient, createAdminServiceClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';

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
            const frontendClient = createFrontendServiceClient();
            const adminClient = createAdminServiceClient();

            // Fetch user info
            const { data: profile } = await frontendClient
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();

            const { data: userData } = await frontendClient
                .from('users')
                .select('email')
                .eq('id', userId)
                .single();

            if (profile && userData) {
                setUserInfo({
                    full_name: profile.full_name || 'Unknown User',
                    email: userData.email
                });
            }

            // Fetch certificates
            const { data: certificates } = await frontendClient
                .from('certificates')
                .select('id, certificate_name, certificate_url, created_at')
                .eq('user_id', userId);

            // Fetch certificate_documents
            const { data: certDocs } = await frontendClient
                .from('certificate_documents')
                .select('id, document_name, document_type, file_url, created_at')
                .eq('user_id', userId);

            // Fetch documents (resumes etc)
            const { data: docs } = await frontendClient
                .from('documents')
                .select('id, title, document_type, file_url, created_at')
                .eq('user_id', userId);

            // Fetch profile photo and govt ID
            const { data: profileData } = await frontendClient
                .from('profiles')
                .select('profile_photo_url, govt_id_url')
                .eq('id', userId)
                .single();

            // Fetch existing verifications from admin DB
            const { data: verifications } = await adminClient
                .from('document_verifications')
                .select('document_id, status, ocr_extracted')
                .eq('user_id', userId);

            const verificationMap = new Map(
                verifications?.map(v => [v.document_id, { status: v.status, ocr: v.ocr_extracted }]) || []
            );

            // Combine all documents
            const allDocs: DocumentItem[] = [];

            // Add certificates
            certificates?.forEach(cert => {
                const verification = verificationMap.get(cert.id);
                allDocs.push({
                    id: cert.id,
                    document_type: 'Certification',
                    upload_date: cert.created_at,
                    file_url: cert.certificate_url,
                    source_table: 'certificates',
                    status: verification?.status || 'pending',
                    ocr_extracted: verification?.ocr || false
                });
            });

            // Add certificate documents
            certDocs?.forEach(doc => {
                const verification = verificationMap.get(doc.id);
                allDocs.push({
                    id: doc.id,
                    document_type: doc.document_type || doc.document_name,
                    upload_date: doc.created_at,
                    file_url: doc.file_url,
                    source_table: 'certificate_documents',
                    status: verification?.status || 'pending',
                    ocr_extracted: verification?.ocr || false
                });
            });

            // Add resumes/documents
            docs?.forEach(doc => {
                const verification = verificationMap.get(doc.id);
                allDocs.push({
                    id: doc.id,
                    document_type: doc.document_type === 'resume' ? 'Resume' : doc.title,
                    upload_date: doc.created_at,
                    file_url: doc.file_url,
                    source_table: 'documents',
                    status: verification?.status || 'pending',
                    ocr_extracted: verification?.ocr || false
                });
            });

            // Add profile photo if exists
            if (profileData?.profile_photo_url) {
                allDocs.push({
                    id: `${userId}_profile_photo`,
                    document_type: 'Profile Photo',
                    upload_date: new Date().toISOString(),
                    file_url: profileData.profile_photo_url,
                    source_table: 'profiles',
                    status: verificationMap.get(`${userId}_profile_photo`)?.status || 'pending',
                    ocr_extracted: false
                });
            }

            // Add govt ID if exists
            if (profileData?.govt_id_url) {
                allDocs.push({
                    id: `${userId}_govt_id`,
                    document_type: 'Government ID',
                    upload_date: new Date().toISOString(),
                    file_url: profileData.govt_id_url,
                    source_table: 'profiles',
                    status: verificationMap.get(`${userId}_govt_id`)?.status || 'pending',
                    ocr_extracted: false
                });
            }

            setDocuments(allDocs);
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
                    <span className="text-gray-900">Manage Certificates</span>
                </div>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
                    <p className="text-gray-500 mt-1">
                        Manage user documents{userInfo ? ` for ${userInfo.full_name}` : ''}.
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
                                                            href={doc.file_url}
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
