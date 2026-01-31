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

        // Fetch user emails from auth.users using Admin API
        const { data: authData, error: authError } = await frontendClient.auth.admin.listUsers({
            perPage: 1000
        });

        if (authError) {
            console.error('Error fetching auth users:', authError);
        }

        // Create a map of user emails
        const userEmailMap = new Map(
            authData?.users?.map(u => [u.id, { email: u.email, is_verified: u.email_confirmed_at !== null }]) || []
        );

        // Fetch job search status
        const { data: jobStatus, error: jobError } = await frontendClient
            .from('job_search_status')
            .select('user_id, is_active')
            .in('user_id', userIds);

        if (jobError) {
            console.error('Error fetching job status:', jobError);
        }

        // Get blocked user IDs from profiles (is_blocked field)
        const blockedUserIds = new Set(profiles.filter(p => p.is_blocked === true).map(p => p.id));

        // Filter by user type if specified
        let filteredProfiles = profiles;
        if (userType === 'blocked') {
            filteredProfiles = profiles.filter(p => p.is_blocked === true);
        } else if (userType === 'active') {
            const activeJobUserIds = new Set(jobStatus?.filter(j => j.is_active).map(j => j.user_id) || []);
            filteredProfiles = profiles.filter(p => activeJobUserIds.has(p.id) && !blockedUserIds.has(p.id));
        } else if (userType === 'inactive') {
            const activeJobUserIds = new Set(jobStatus?.filter(j => j.is_active).map(j => j.user_id) || []);
            filteredProfiles = profiles.filter(p => !activeJobUserIds.has(p.id) && !blockedUserIds.has(p.id));
        }

        // Combine all data
        const usersWithDetails = filteredProfiles.map(profile => {
            const userInfo = userEmailMap.get(profile.id);
            const jobInfo = jobStatus?.find(j => j.user_id === profile.id);
            const isBlocked = profile.is_blocked === true;

            return {
                id: profile.id,
                full_name: profile.full_name || 'Unnamed User',
                email: userInfo?.email || 'Unknown',
                primary_email: profile.primary_email,
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
