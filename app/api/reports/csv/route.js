import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Papa from 'papaparse'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? new Date().toISOString().split('T')[0]
  const to = searchParams.get('to') ?? from
  const type = searchParams.get('type') ?? 'kra'

  if (type === 'kra') {
    const { data } = await supabase
      .from('kra_assignments')
      .select(`
        assigned_date,
        users(full_name, teams(team_name)),
        kra_templates(title, kra_type, target_value),
        kra_logs(achieved_value, status, comments, submitted_at, submission_status)
      `)
      .gte('assigned_date', from)
      .lte('assigned_date', to)

    const rows = (data ?? []).map((a) => ({
      Date: a.assigned_date,
      Employee: a.users?.full_name ?? '',
      Team: a.users?.teams?.team_name ?? '',
      KRA: a.kra_templates?.title ?? '',
      Type: a.kra_templates?.kra_type ?? '',
      Target: a.kra_templates?.target_value ?? '',
      Achieved: a.kra_logs?.[0]?.achieved_value ?? '',
      Status: a.kra_logs?.[0]?.status ?? 'not_submitted',
      'Submission Status': a.kra_logs?.[0]?.submission_status ?? 'missing',
      'Submitted At': a.kra_logs?.[0]?.submitted_at ?? '',
      Comments: a.kra_logs?.[0]?.comments ?? '',
    }))

    const csv = Papa.unparse(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="kra-report-${from}-to-${to}.csv"`,
      },
    })
  }

  const { data } = await supabase
    .from('ads_logs')
    .select(`*, ad_accounts(account_name, platform, client_name), users(full_name)`)
    .gte('log_date', from)
    .lte('log_date', to)

  const rows = (data ?? []).map((l) => ({
    Date: l.log_date,
    Employee: l.users?.full_name ?? '',
    Account: l.ad_accounts?.account_name ?? '',
    Platform: l.ad_accounts?.platform ?? '',
    Client: l.ad_accounts?.client_name ?? '',
    'Budget Set': l.daily_budget_set,
    'Actual Spend': l.daily_spend_actual,
    'Budget Util %': l.budget_utilisation_pct ?? '',
    Leads: l.leads_generated,
    'Lead Target': l.lead_target,
    'Lead Achievement %': l.lead_achievement_pct ?? '',
    Conversions: l.conversions,
    'Conv Value': l.conversion_value,
    CPL: l.cost_per_lead ?? '',
    'Cost/Conv': l.cost_per_conversion ?? '',
    ROAS: l.roas ?? '',
    'Campaign Status': l.campaign_status,
    'Submission Status': l.submission_status ?? 'missing',
  }))

  const csv = Papa.unparse(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="ads-report-${from}-to-${to}.csv"`,
    },
  })
}
