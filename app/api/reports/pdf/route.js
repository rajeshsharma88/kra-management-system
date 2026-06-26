export const runtime = 'nodejs'
export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? new Date().toISOString().split('T')[0]
  const to = searchParams.get('to') ?? from

  const [kraData, adsData] = await Promise.all([
    supabase
      .from('kra_assignments')
      .select(`assigned_date, users(full_name, teams(team_name)), kra_templates(title, kra_type, target_value), kra_logs(achieved_value, status, submission_status)`)
      .gte('assigned_date', from)
      .lte('assigned_date', to),
    supabase
      .from('ads_logs')
      .select(`*, ad_accounts(account_name, platform), users(full_name)`)
      .gte('log_date', from)
      .lte('log_date', to),
  ])

  const html = buildReportHtml(from, to, kraData.data ?? [], adsData.data ?? [])

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } })
  await browser.close()

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="kra-report-${from}-to-${to}.pdf"`,
    },
  })
}

function buildReportHtml(from, to, kras, ads) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KRA Report ${from} to ${to}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; }
    h1 { font-size: 20px; color: #4f46e5; margin-bottom: 4px; }
    h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0f172a; color: white; text-align: left; padding: 8px; font-size: 11px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge-green { background: #16a34a; color: white; padding: 2px 6px; border-radius: 999px; font-size: 10px; }
    .badge-red { background: #dc2626; color: white; padding: 2px 6px; border-radius: 999px; font-size: 10px; }
    .badge-amber { background: #d97706; color: white; padding: 2px 6px; border-radius: 999px; font-size: 10px; }
  </style>
</head>
<body>
  <h1>KRA Manager — Performance Report</h1>
  <p>Period: ${from} to ${to}</p>

  <h2>KRA Summary</h2>
  <table>
    <thead><tr><th>Date</th><th>Employee</th><th>Team</th><th>KRA</th><th>Target</th><th>Achieved</th><th>Status</th><th>Submission</th></tr></thead>
    <tbody>
      ${kras.map((a) => `<tr>
        <td>${a.assigned_date}</td>
        <td>${a.users?.full_name ?? ''}</td>
        <td>${a.users?.teams?.team_name ?? ''}</td>
        <td>${a.kra_templates?.title ?? ''}</td>
        <td>${a.kra_templates?.target_value ?? '—'}</td>
        <td>${a.kra_logs?.[0]?.achieved_value ?? '—'}</td>
        <td>${a.kra_logs?.[0]?.status ?? 'not_submitted'}</td>
        <td>${a.kra_logs?.[0]?.submission_status ?? 'missing'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Ads Performance Summary</h2>
  <table>
    <thead><tr><th>Date</th><th>Employee</th><th>Account</th><th>Platform</th><th>Spend</th><th>Leads</th><th>Conv.</th><th>ROAS</th><th>Status</th></tr></thead>
    <tbody>
      ${ads.map((l) => `<tr>
        <td>${l.log_date}</td>
        <td>${l.users?.full_name ?? ''}</td>
        <td>${l.ad_accounts?.account_name ?? ''}</td>
        <td>${l.ad_accounts?.platform?.toUpperCase() ?? ''}</td>
        <td>₹${l.daily_spend_actual?.toLocaleString('en-IN') ?? 0}</td>
        <td>${l.leads_generated ?? 0}</td>
        <td>${l.conversions ?? 0}</td>
        <td>${l.roas ? l.roas + 'x' : '—'}</td>
        <td>${l.submission_status ?? 'missing'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`
}
