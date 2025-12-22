import { NextRequest, NextResponse } from 'next/server';
import { getAdminServiceClient } from '@/lib/supabase';

// GET - Fetch all API keys
export async function GET() {
    try {
        const adminClient = getAdminServiceClient();

        const { data, error } = await adminClient
            .from('api_keys')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching API keys:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ keys: data || [] });
    } catch (error) {
        console.error('API keys GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
    try {
        const adminClient = getAdminServiceClient();
        const body = await request.json();

        const { api_name, variable_name, api_key_value, expiry_date, admin_id } = body;

        if (!api_name || !variable_name || !api_key_value) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await adminClient
            .from('api_keys')
            .insert({
                api_name,
                variable_name,
                api_key_value,
                expiry_date: expiry_date || null,
                created_by: admin_id || null,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating API key:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log the action
        if (admin_id) {
            await adminClient.from('activity_logs').insert({
                admin_id,
                action_type: 'add_api_key',
                action_description: `Added new API key: ${api_name}`,
                metadata: { key_name: api_name }
            });
        }

        return NextResponse.json({ key: data });
    } catch (error) {
        console.error('API keys POST error:', error);
        return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }
}

// PUT - Update API key
export async function PUT(request: NextRequest) {
    try {
        const adminClient = getAdminServiceClient();
        const body = await request.json();

        const { id, api_name, variable_name, api_key_value, expiry_date, admin_id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing key ID' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (api_name) updateData.api_name = api_name;
        if (variable_name) updateData.variable_name = variable_name;
        if (api_key_value) updateData.api_key_value = api_key_value;
        if (expiry_date !== undefined) updateData.expiry_date = expiry_date || null;

        const { data, error } = await adminClient
            .from('api_keys')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating API key:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log the action
        if (admin_id) {
            await adminClient.from('activity_logs').insert({
                admin_id,
                action_type: 'update_api_key',
                action_description: `Updated API key: ${data.api_name}`,
                metadata: { key_name: data.api_name }
            });
        }

        return NextResponse.json({ key: data });
    } catch (error) {
        console.error('API keys PUT error:', error);
        return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
    }
}

// DELETE - Delete API key
export async function DELETE(request: NextRequest) {
    try {
        const adminClient = getAdminServiceClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const admin_id = searchParams.get('admin_id');

        if (!id) {
            return NextResponse.json({ error: 'Missing key ID' }, { status: 400 });
        }

        // Get key name for logging before deleting
        const { data: keyData } = await adminClient
            .from('api_keys')
            .select('api_name')
            .eq('id', id)
            .single();

        const { error } = await adminClient
            .from('api_keys')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting API key:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log the action
        if (admin_id && keyData) {
            await adminClient.from('activity_logs').insert({
                admin_id,
                action_type: 'delete_api_key',
                action_description: `Deleted API key: ${keyData.api_name}`,
                metadata: { key_name: keyData.api_name }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('API keys DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    }
}
