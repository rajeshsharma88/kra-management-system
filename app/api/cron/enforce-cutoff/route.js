import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const { data: assignments, error: assignError } = await supabase
    .from('kra_assignments')
    .select('id, user_id')
    .eq('assigned_date', today)

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })
  if (!assignments?.length) {
    return NextResponse.json({ message: 'No assignments for today', marked: 0 })
  }

  // Fetch all kra_logs for today to know which are submitted vs draft vs missing
  const assignmentIds = assignments.map((a) => a.id)
  const { data: existingLogs, error: logError } = await supabase
    .from('kra_logs')
    .select('id, assignment_id, user_id, is_draft')
    .eq('log_date', today)
    .in('assignment_id', assignmentIds)

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const submittedKeys = new Set(
    (existingLogs ?? []).filter((l) => !l.is_draft).map((l) => `${l.assignment_id}:${l.user_id}`)
  )
  // Map draft logs by key so we can update them instead of inserting
  const draftIdByKey = new Map(
    (existingLogs ?? []).filter((l) => l.is_draft).map((l) => [`${l.assignment_id}:${l.user_id}`, l.id])
  )

  const unsubmitted = assignments.filter(
    (a) => !submittedKeys.has(`${a.id}:${a.user_id}`)
  )

  if (!unsubmitted.length) {
    return NextResponse.json({ message: 'All assignments already submitted', marked: 0 })
  }

  const nowIso = now.toISOString()
  const draftIdsToUpdate = []
  const newMissedLogs = []

  for (const a of unsubmitted) {
    const key = `${a.id}:${a.user_id}`
    if (draftIdByKey.has(key)) {
      draftIdsToUpdate.push(draftIdByKey.get(key))
    } else {
      newMissedLogs.push({
        assignment_id: a.id,
        user_id: a.user_id,
        log_date: today,
        is_draft: false,
        submission_status: 'missed',
        submitted_at: nowIso,
        updated_at: nowIso,
      })
    }
  }

  const errors = []

  if (draftIdsToUpdate.length) {
    const { error } = await supabase
      .from('kra_logs')
      .update({
        is_draft: false,
        submission_status: 'missed',
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .in('id', draftIdsToUpdate)
    if (error) errors.push(`draft update: ${error.message}`)
  }

  if (newMissedLogs.length) {
    const { error } = await supabase.from('kra_logs').insert(newMissedLogs)
    if (error) errors.push(`insert missed: ${error.message}`)
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({
    message: `Marked ${unsubmitted.length} assignment(s) as missed`,
    marked: unsubmitted.length,
    date: today,
  })
}
