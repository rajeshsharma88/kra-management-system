import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  let query = supabase
    .from('ad_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data })
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { platform, account_name, account_ref_id, client_name, monthly_budget, daily_lead_target, assigned_user_ids } = body

  if (!platform || !account_name || !client_name) {
    return NextResponse.json({ error: 'platform, account_name, and client_name are required' }, { status: 400 })
  }
  if (!assigned_user_ids?.length) {
    return NextResponse.json({ error: 'At least one employee must be assigned' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ad_accounts')
    .insert({
      platform,
      account_name,
      account_ref_id: account_ref_id || null,
      client_name,
      monthly_budget: monthly_budget ?? 0,
      daily_lead_target: daily_lead_target ?? 0,
      assigned_user_ids: assigned_user_ids ?? [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data }, { status: 201 })
}
