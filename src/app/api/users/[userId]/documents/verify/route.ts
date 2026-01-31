import { NextRequest, NextResponse } from 'next/server';
import { getAdminServiceClient } from '@/lib/supabase';
import { validateAdminRequest } from '@/lib/auth-utils';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    // Validate admin session
    const { user: authedUser, error: authError } = await validateAdminRequest(request);
    if (authError || !authedUser) {
        return NextResponse.json(
            { error: 'Unauthorized: ' + authError },
            { status: 401 }
        );
    }

    try {
        const { userId } = await params;
        const body = await request.json();
        const { documentId, documentType, sourceTable, action, adminId, adminEmail, userEmail } = body;

        // Verify user ID match
        if (adminId && adminId !== authedUser.id) {
            return NextResponse.json(
                { error: 'Unauthorized: User ID mismatch' },
                { status: 401 }
            );
        }

        if (!documentId || !action) {
            return NextResponse.json(
                { error: 'Document ID and action are required' },
                { status: 400 }
            );
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json(
                { error: 'Invalid action. Must be "approve" or "reject"' },
                { status: 400 }
            );
        }

        const adminClient = getAdminServiceClient();

        // Upsert the verification record
        const { error: verifyError } = await adminClient
            .from('document_verifications')
            .upsert({
                user_id: userId,
                document_id: documentId,
                document_type: documentType,
                document_table: sourceTable,
                status: action === 'approve' ? 'approved' : 'rejected',
                verified_by: adminId,
                verified_at: new Date().toISOString()
            }, { onConflict: 'document_id' });

        if (verifyError) {
            console.error('Error updating verification:', verifyError);
            throw verifyError;
        }

        // Log the action
        await adminClient.from('activity_logs').insert({
            admin_id: adminId,
            admin_email: adminEmail,
            action_type: action === 'approve' ? 'approve_document' : 'reject_document',
            action_description: `${action === 'approve' ? 'Approved' : 'Rejected'} ${documentType} for user`,
            target_user_id: userId,
            target_user_email: userEmail
        });

        return NextResponse.json({
            success: true,
            message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        console.error('Error in document verification API:', error);
        return NextResponse.json(
            { error: 'Failed to verify document' },
            { status: 500 }
        );
    }
}
