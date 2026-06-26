import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? new Date().toISOString().split('T')[0]
  const to = searchParams.get('to') ?? from

  const [kraRes, adsRes] = await Promise.all([
    supabase
      .from('kra_assignments')
      .select(`
        id, assigned_date,
        users(id, full_name, teams(team_name)),
        kra_templates(title, kra_type, target_value),
        kra_logs(achieved_value, status, comments, submission_status)
      `)
      .gte('assigned_date', from)
      .lte('assigned_date', to)
      .order('assigned_date', { ascending: true }),
    supabase
      .from('ads_logs')
      .select(`
        id, log_date, daily_spend_actual, leads_generated, conversions, roas, campaign_status,
        ad_accounts(account_name, platform, client_name),
        users(full_name)
      `)
      .gte('log_date', from)
      .lte('log_date', to)
      .order('log_date', { ascending: true }),
  ])

  return NextResponse.json({
    kra: kraRes.data ?? [],
    ads: adsRes.data ?? [],
  })
}
