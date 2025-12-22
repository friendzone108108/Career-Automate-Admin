import { NextRequest, NextResponse } from 'next/server';
import { getFrontendServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const frontendClient = getFrontendServiceClient();

        const { searchParams } = new URL(request.url);
        const location = searchParams.get('location') || '';
        const newUsers = searchParams.get('newUsers') === 'true';
        const oldUsers = searchParams.get('oldUsers') === 'true';
        const statType = searchParams.get('statType') || 'totalUsers'; // totalUsers, activeJobSearchers

        // Build base query for profiles
        let query = frontendClient.from('profiles').select('id, address, created_at', { count: 'exact' });

        // Apply location filter
        if (location) {
            query = query.ilike('address', `%${location}%`);
        }

        // Apply time-based filters
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (newUsers && !oldUsers) {
            query = query.gte('created_at', thirtyDaysAgo.toISOString());
        } else if (oldUsers && !newUsers) {
            query = query.lt('created_at', thirtyDaysAgo.toISOString());
        }

        const { data: profiles, count, error } = await query;

        if (error) {
            console.error('Error fetching filtered stats:', error);
            return NextResponse.json({ error: 'Failed to fetch filtered stats' }, { status: 500 });
        }

        // For active job searchers, we need additional filtering
        if (statType === 'activeJobSearchers' && profiles && profiles.length > 0) {
            const userIds = profiles.map(p => p.id);

            const { count: activeCount, error: jobError } = await frontendClient
                .from('job_search_status')
                .select('*', { count: 'exact', head: true })
                .in('user_id', userIds)
                .eq('is_active', true);

            if (jobError) {
                console.error('Error fetching job status:', jobError);
            }

            return NextResponse.json({ count: activeCount || 0 });
        }

        return NextResponse.json({ count: count || 0 });
    } catch (error) {
        console.error('Filtered stats error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch filtered stats' },
            { status: 500 }
        );
    }
}
