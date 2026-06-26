import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('kra_logs')
    .select(`
      id, log_date, achieved_value, status, comments, submitted_at, submission_status,
      kra_assignments(
        id,
        kra_templates(id, title, kra_type, target_value, description)
      )
    `)
    .eq('user_id', user.id)
    .eq('is_draft', false)
    .order('log_date', { ascending: false })

  if (date) {
    query = query.eq('log_date', date)
  } else {
    query = query.lt('log_date', today)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byDate = {}
  for (const log of data ?? []) {
    if (!byDate[log.log_date]) byDate[log.log_date] = []
    byDate[log.log_date].push(log)
  }

  const history = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([d, logs]) => ({ date: d, logs }))

  return NextResponse.json({ history })
}
