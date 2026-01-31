import { NextRequest, NextResponse } from 'next/server';
import { createAdminServiceClient, createFrontendServiceClient } from '@/lib/supabase';
import { validateAdminRequest } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
    // Validate admin session
    const { user: authedUser, error: authError } = await validateAdminRequest(request);
    if (authError || !authedUser) {
        return NextResponse.json(
            { error: 'Unauthorized: ' + authError },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { controlKey, controlValue, adminEmail, adminId } = body;

        // Verify that the ID in body matches the authenticated user (prevent spoofing)
        if (adminId && adminId !== authedUser.id) {
            return NextResponse.json(
                { error: 'Unauthorized: User ID mismatch' },
                { status: 401 }
            );
        }

        if (!controlKey || controlValue === undefined) {
            return NextResponse.json(
                { error: 'Missing controlKey or controlValue' },
                { status: 400 }
            );
        }

        const adminClient = createAdminServiceClient();
        const frontendClient = createFrontendServiceClient();

        // Update admin DB - system_controls
        const { error: adminError } = await adminClient
            .from('system_controls')
            .upsert({
                control_key: controlKey,
                control_value: controlValue,
                updated_by: adminId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'control_key' });

        if (adminError) {
            console.error('Error updating admin DB:', adminError);
            // Continue - try updating frontend DB as well
        }

        // Map control keys if necessary (standardized to match DB schema)
        const frontendControlKey = controlKey;

        // Update frontend DB
        // If they are the same DB, this might be redundant but harmless (upsert)
        const { error: frontendError } = await frontendClient
            .from('system_controls')
            .upsert({
                control_key: frontendControlKey,
                control_value: controlValue,
                updated_at: new Date().toISOString(),
                updated_by: adminEmail
            }, { onConflict: 'control_key' });
        // Note: Changed .update() to .upsert() to be safe if row missing

        if (frontendError) {
            console.error('Error updating frontend DB:', frontendError);
            // If admin update succeeded, we can return success, but log this error.
            // If both failed, we should probably return error.
            if (adminError) {
                return NextResponse.json(
                    { error: 'Failed to update controls', details: frontendError.message },
                    { status: 500 }
                );
            }
        }

        // Log the action
        const actionType = controlKey === 'emergency_stop' ? 'emergency_stop' : 'stop_all_automations';
        const actionDescription = controlKey === 'emergency_stop'
            ? (controlValue ? '🚨 Emergency stop ACTIVATED - Users cannot login' : '✅ Emergency stop DEACTIVATED - Users can login again')
            : (controlValue ? '⛔ All automations STOPPED - Automation buttons disabled' : '✅ All automations RESUMED - Automation buttons enabled');

        await adminClient.from('activity_logs').insert({
            admin_id: adminId,
            admin_email: adminEmail,
            action_type: actionType,
            action_description: actionDescription
        });

        return NextResponse.json({
            success: true,
            message: `Control ${controlKey} updated to ${controlValue}`
        });

    } catch (error) {
        console.error('Error in control update:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
