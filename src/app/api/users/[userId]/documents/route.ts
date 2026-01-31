import { NextRequest, NextResponse } from 'next/server';
import { getFrontendServiceClient, getAdminServiceClient } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const frontendClient = getFrontendServiceClient();
        const adminClient = getAdminServiceClient();

        // Fetch user profile including profile_photo_url and govt_id_url
        const { data: profile, error: profileError } = await frontendClient
            .from('profiles')
            .select('full_name, profile_photo_url, govt_id_url')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
        }

        // Fetch user email using Admin API
        const { data: authUser } = await frontendClient.auth.admin.getUserById(userId);

        // Fetch resumes/documents from documents table
        const { data: docs, error: docsError } = await frontendClient
            .from('documents')
            .select('id, title, document_type, file_url, created_at, role')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (docsError) {
            console.error('Error fetching documents:', docsError);
        }

        // Fetch existing verifications from admin DB
        const { data: verifications } = await adminClient
            .from('document_verifications')
            .select('document_id, status, ocr_extracted')
            .eq('user_id', userId);

        const verificationMap = new Map(
            verifications?.map(v => [v.document_id, { status: v.status, ocr: v.ocr_extracted }]) || []
        );

        // Build documents list: Resumes + Profile Photo + Govt ID
        const allDocs: any[] = [];

        // Add resumes/documents
        docs?.forEach(doc => {
            const verification = verificationMap.get(doc.id);
            allDocs.push({
                id: doc.id,
                document_type: doc.role ? `Resume - ${doc.role}` : (doc.title || 'Resume'),
                upload_date: doc.created_at,
                file_url: doc.file_url,
                source_table: 'documents',
                status: verification?.status || 'pending',
                ocr_extracted: verification?.ocr || false
            });
        });

        // Add profile photo if exists
        if (profile?.profile_photo_url) {
            allDocs.push({
                id: `${userId}_profile_photo`,
                document_type: 'Profile Photo',
                upload_date: new Date().toISOString(),
                file_url: profile.profile_photo_url,
                source_table: 'profiles',
                status: verificationMap.get(`${userId}_profile_photo`)?.status || 'pending',
                ocr_extracted: false
            });
        }

        // Add govt ID if exists
        if (profile?.govt_id_url) {
            allDocs.push({
                id: `${userId}_govt_id`,
                document_type: 'Government ID',
                upload_date: new Date().toISOString(),
                file_url: profile.govt_id_url,
                source_table: 'profiles',
                status: verificationMap.get(`${userId}_govt_id`)?.status || 'pending',
                ocr_extracted: false
            });
        }

        return NextResponse.json({
            documents: allDocs,
            userInfo: {
                full_name: profile?.full_name || 'Unknown User',
                email: authUser?.user?.email || 'Unknown'
            }
        });
    } catch (error) {
        console.error('Error in user documents API:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user documents' },
            { status: 500 }
        );
    }
}
