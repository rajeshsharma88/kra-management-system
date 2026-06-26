import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  calcBudgetUtilisation,
  calcLeadAchievement,
  calcCPL,
  calcCostPerConversion,
  calcROAS,
} from '@/lib/calculations'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const userId = searchParams.get('user_id')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  let query = supabase
    .from('ads_logs')
    .select(`*, ad_accounts(id, account_name, platform, client_name, daily_lead_target)`)
    .order('log_date', { ascending: true })

  if (startDate && endDate) {
    query = query.gte('log_date', startDate).lte('log_date', endDate)
  } else {
    query = query.eq('log_date', date ?? new Date().toISOString().split('T')[0])
  }

  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  } else if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ads_logs: data })
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, is_paid_ads_member').eq('id', user.id).single()
  if (!profile?.is_paid_ads_member && profile?.role === 'employee') {
    return NextResponse.json({ error: 'Forbidden — not a Paid Ads member' }, { status: 403 })
  }

  const body = await request.json()
  const {
    account_id, log_date, daily_budget_set, daily_spend_actual,
    leads_generated, conversions, conversion_value,
    campaign_status, notes, is_draft,
  } = body

  const { data: settings } = await supabase
    .from('settings')
    .select('setting_key, setting_value')

  const settingsMap = Object.fromEntries((settings ?? []).map((r) => [r.setting_key, r.setting_value]))
  const cutoffStr = settingsMap.daily_cutoff_time ?? '19:00'
  const [ch, cm] = cutoffStr.split(':').map(Number)
  const today = new Date()
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate(), ch, cm, 0)
  const now = new Date()
  const submissionStatus = is_draft ? null : (now <= cutoff ? 'on_time' : 'late')

  const { data: account } = await supabase
    .from('ad_accounts')
    .select('daily_lead_target')
    .eq('id', account_id)
    .single()

  const leadTarget = account?.daily_lead_target ?? 0

  const logData = {
    account_id,
    user_id: user.id,
    log_date,
    daily_budget_set,
    daily_spend_actual,
    budget_utilisation_pct: calcBudgetUtilisation(daily_spend_actual, daily_budget_set),
    leads_generated,
    lead_target: leadTarget,
    lead_achievement_pct: calcLeadAchievement(leads_generated, leadTarget),
    conversions,
    conversion_value,
    cost_per_lead: calcCPL(daily_spend_actual, leads_generated),
    cost_per_conversion: calcCostPerConversion(daily_spend_actual, conversions),
    roas: calcROAS(conversion_value, daily_spend_actual),
    campaign_status,
    notes,
    submitted_at: is_draft ? null : now.toISOString(),
    submission_status: submissionStatus,
    is_draft: is_draft ?? false,
  }

  const { data: existing } = await supabase
    .from('ads_logs')
    .select('id')
    .eq('account_id', account_id)
    .eq('user_id', user.id)
    .eq('log_date', log_date)
    .single()

  let error
  if (existing) {
    ;({ error } = await supabase.from('ads_logs').update(logData).eq('id', existing.id))
  } else {
    ;({ error } = await supabase.from('ads_logs').insert(logData))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true }, { status: 201 })
}
