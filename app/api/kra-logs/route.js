import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { assignment_id, log_date, achieved_value, status, comments, is_draft } = body

  if (!assignment_id || !log_date || !status) {
    return NextResponse.json(
      { error: 'assignment_id, log_date, and status are required' },
      { status: 400 }
    )
  }

  let submission_status = null
  let submitted_at = null

  if (!is_draft) {
    const { data: settings } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'daily_cutoff_time')
      .single()

    const cutoffStr = settings?.setting_value ?? '19:00'
    const [hours, minutes] = cutoffStr.split(':').map(Number)
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0)
    submission_status = now <= cutoff ? 'on_time' : 'late'
    submitted_at = now.toISOString()
  }

  const { data, error } = await supabase
    .from('kra_logs')
    .upsert(
      {
        assignment_id,
        user_id: user.id,
        log_date,
        achieved_value: achieved_value ?? null,
        status,
        comments: comments ?? null,
        is_draft: is_draft ?? true,
        submitted_at,
        submission_status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,user_id,log_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log: data })
}
