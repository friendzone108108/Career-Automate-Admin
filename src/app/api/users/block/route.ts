import { NextRequest, NextResponse } from 'next/server';
import { getFrontendServiceClient, getAdminServiceClient } from '@/lib/supabase';
import { validateAdminRequest } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
    // Validate admin session
    const { user: adminUser, error: authError } = await validateAdminRequest(request);
    if (authError || !adminUser) {
        return NextResponse.json(
            { error: 'Unauthorized: ' + authError },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { userId, userEmail, action, blockedBy, blockedReason } = body;

        if (!userId || !action) {
            return NextResponse.json(
                { error: 'User ID and action are required' },
                { status: 400 }
            );
        }

        if (action !== 'block' && action !== 'unblock') {
            return NextResponse.json(
                { error: 'Invalid action. Must be "block" or "unblock"' },
                { status: 400 }
            );
        }

        const frontendClient = getFrontendServiceClient();
        const adminClient = getAdminServiceClient();

        const isBlocking = action === 'block';

        // Update the user's is_blocked status in the frontend profiles table
        const { error: updateError } = await frontendClient
            .from('profiles')
            .update({
                is_blocked: isBlocking,
                blocked_at: isBlocking ? new Date().toISOString() : null,
                blocked_reason: isBlocking ? (blockedReason || 'Blocked by admin') : null
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating profile blocked status:', updateError);
            throw updateError;
        }

        // Log the action in admin activity logs
        await adminClient.from('activity_logs').insert({
            admin_id: blockedBy,
            action_type: isBlocking ? 'block_user' : 'unblock_user',
            action_description: `${isBlocking ? 'Blocked' : 'Unblocked'} user: ${userEmail}`,
            target_user_id: userId,
            target_user_email: userEmail
        });

        return NextResponse.json({
            success: true,
            message: `User ${isBlocking ? 'blocked' : 'unblocked'} successfully`
        });
    } catch (error) {
        console.error('Error in block user API:', error);
        return NextResponse.json(
            { error: 'Failed to update user block status' },
            { status: 500 }
        );
    }
}
