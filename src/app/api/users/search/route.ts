import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use environment variables
const FRONTEND_SUPABASE_URL = process.env.FRONTEND_SUPABASE_URL;
const FRONTEND_SUPABASE_SERVICE_ROLE_KEY = process.env.FRONTEND_SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';

        if (!query || query.length < 2) {
            return NextResponse.json({ users: [] });
        }

        if (!FRONTEND_SUPABASE_URL || !FRONTEND_SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'Supabase credentials not configured' },
                { status: 500 }
            );
        }

        const supabase = createClient(FRONTEND_SUPABASE_URL, FRONTEND_SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Use the Admin API to list users
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
            perPage: 100
        });

        if (authError) {
            console.error('Error listing users:', authError);
            return NextResponse.json(
                { error: 'Failed to fetch users' },
                { status: 500 }
            );
        }

        // Get all profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, secondary_email');

        // Combine auth users with profiles and filter by search query
        const searchLower = query.toLowerCase();
        const users = authData.users
            .map(user => {
                const profile = profiles?.find(p => p.id === user.id);
                return {
                    id: user.id,
                    email: user.email || '',
                    full_name: profile?.full_name || user.user_metadata?.full_name || 'Unknown',
                    secondary_email: profile?.secondary_email || null
                };
            })
            .filter(user => {
                return (
                    user.email.toLowerCase().includes(searchLower) ||
                    user.full_name.toLowerCase().includes(searchLower) ||
                    (user.secondary_email && user.secondary_email.toLowerCase().includes(searchLower))
                );
            })
            .slice(0, 10); // Limit to 10 results

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error('Error searching users:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to search users' },
            { status: 500 }
        );
    }
}
