import { NextRequest, NextResponse } from 'next/server';
import { getAdminServiceClient, getFrontendServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const frontendClient = getFrontendServiceClient();
        const adminClient = getAdminServiceClient();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const search = searchParams.get('search') || '';
        const location = searchParams.get('location') || '';
        const signup = searchParams.get('signup') || '';
        const userType = searchParams.get('userType') || '';

        // Build the query
        let query = frontendClient
            .from('profiles')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Apply search filter
        if (search) {
            query = query.ilike('full_name', `%${search}%`);
        }

        // Apply location filter
        if (location) {
            query = query.ilike('address', `%${location}%`);
        }

        // Apply signup date filter
        if (signup) {
            const now = new Date();
            let dateFilter: Date;

            switch (signup) {
                case '7days':
                    dateFilter = new Date(now.setDate(now.getDate() - 7));
                    break;
                case '30days':
                    dateFilter = new Date(now.setDate(now.getDate() - 30));
                    break;
                case '90days':
                    dateFilter = new Date(now.setDate(now.getDate() - 90));
                    break;
                default:
                    dateFilter = new Date(0);
            }

            query = query.gte('created_at', dateFilter.toISOString());
        }

        // Apply pagination
        query = query.range((page - 1) * pageSize, page * pageSize - 1);

        const { data: profiles, count, error: profilesError } = await query;

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
        }

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({
                users: [],
                total: 0,
                page,
                pageSize
            });
        }

        // Get user IDs for joining with other tables
        const userIds = profiles.map(p => p.id);

        // Fetch user emails from auth.users (via users table)
        const { data: usersData, error: usersError } = await frontendClient
            .from('users')
            .select('id, email, is_verified')
            .in('id', userIds);

        if (usersError) {
            console.error('Error fetching users data:', usersError);
        }

        // Fetch job search status
        const { data: jobStatus, error: jobError } = await frontendClient
            .from('job_search_status')
            .select('user_id, is_active')
            .in('user_id', userIds);

        if (jobError) {
            console.error('Error fetching job status:', jobError);
        }

        // Fetch blocked users from admin DB
        const { data: blockedUsers, error: blockedError } = await adminClient
            .from('blocked_users')
            .select('user_id, is_blocked')
            .in('user_id', userIds)
            .eq('is_blocked', true);

        if (blockedError) {
            console.error('Error fetching blocked users:', blockedError);
        }

        const blockedUserIds = new Set(blockedUsers?.map(b => b.user_id) || []);

        // Filter by user type if specified
        let filteredProfiles = profiles;
        if (userType === 'blocked') {
            filteredProfiles = profiles.filter(p => blockedUserIds.has(p.id));
        } else if (userType === 'active') {
            const activeJobUserIds = new Set(jobStatus?.filter(j => j.is_active).map(j => j.user_id) || []);
            filteredProfiles = profiles.filter(p => activeJobUserIds.has(p.id) && !blockedUserIds.has(p.id));
        } else if (userType === 'inactive') {
            const activeJobUserIds = new Set(jobStatus?.filter(j => j.is_active).map(j => j.user_id) || []);
            filteredProfiles = profiles.filter(p => !activeJobUserIds.has(p.id) && !blockedUserIds.has(p.id));
        }

        // Combine all data
        const usersWithDetails = filteredProfiles.map(profile => {
            const userInfo = usersData?.find(u => u.id === profile.id);
            const jobInfo = jobStatus?.find(j => j.user_id === profile.id);
            const isBlocked = blockedUserIds.has(profile.id);

            return {
                id: profile.id,
                full_name: profile.full_name || 'Unnamed User',
                email: userInfo?.email || 'Unknown',
                is_verified: userInfo?.is_verified || false,
                address: profile.address,
                github_username: profile.github_username,
                skills: profile.skills,
                career_preferences: profile.career_preferences,
                job_status: isBlocked ? 'Blocked' : (jobInfo?.is_active ? 'Actively looking' : 'Not available'),
                is_blocked: isBlocked,
                created_at: profile.created_at
            };
        });

        return NextResponse.json({
            users: usersWithDetails,
            total: count || 0,
            page,
            pageSize
        });
    } catch (error) {
        console.error('Users API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}
