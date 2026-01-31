import { NextRequest, NextResponse } from 'next/server';
import { getAdminServiceClient, getFrontendServiceClient } from '@/lib/supabase';
import { validateAdminRequest } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    // Validate admin session
    const { user: authedUser, error: authError } = await validateAdminRequest(request);
    if (authError || !authedUser) {
        return NextResponse.json(
            { error: 'Unauthorized: ' + authError },
            { status: 401 }
        );
    }

    try {
        const frontendClient = getFrontendServiceClient();
        const adminClient = getAdminServiceClient();

        // Fetch total users from frontend DB
        const { count: totalUsers, error: usersError } = await frontendClient
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (usersError) {
            console.error('Error fetching users:', usersError);
        }

        // Fetch active job searchers
        const { count: activeJobSearchers, error: jobError } = await frontendClient
            .from('job_search_status')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (jobError) {
            console.error('Error fetching job status:', jobError);
        }

        // Fetch pending documents from admin DB
        const { count: pendingDocs, error: docsError } = await adminClient
            .from('document_verifications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (docsError) {
            console.error('Error fetching documents:', docsError);
        }

        // Fetch API key expiry alerts (keys expiring in next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const { count: apiAlerts, error: apiError } = await adminClient
            .from('api_keys')
            .select('*', { count: 'exact', head: true })
            .lte('expiry_date', thirtyDaysFromNow.toISOString())
            .eq('is_active', true);

        if (apiError) {
            console.error('Error fetching API keys:', apiError);
        }

        // Fetch new signups (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count: newSignups, error: signupsError } = await frontendClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', sevenDaysAgo.toISOString());

        if (signupsError) {
            console.error('Error fetching signups:', signupsError);
        }

        // Fetch signups from the previous 7 days (for trend calculation)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { count: prevWeekSignups, error: prevSignupsError } = await frontendClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', fourteenDaysAgo.toISOString())
            .lt('created_at', sevenDaysAgo.toISOString());

        if (prevSignupsError) {
            console.error('Error fetching previous week signups:', prevSignupsError);
        }

        // Calculate trend percentage
        let trendPercent = 0;
        if (prevWeekSignups && prevWeekSignups > 0) {
            trendPercent = Math.round(((newSignups || 0) - prevWeekSignups) / prevWeekSignups * 100);
        } else if (newSignups && newSignups > 0) {
            trendPercent = 100; // All new users
        }

        return NextResponse.json({
            totalUsers: totalUsers || 0,
            activeJobSearchers: activeJobSearchers || 0,
            pendingDocuments: pendingDocs || 0,
            apiKeyAlerts: apiAlerts || 0,
            newSignups: newSignups || 0,
            signupTrend: trendPercent
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        );
    }
}
