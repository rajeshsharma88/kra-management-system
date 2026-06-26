import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const userId = searchParams.get('user_id')
  const teamId = searchParams.get('team_id')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  let query = supabase
    .from('kra_assignments')
    .select(`
      id,
      assigned_date,
      kra_templates(id, title, kra_type, target_value, description),
      users(id, full_name),
      kra_logs(id, achieved_value, status, comments, submitted_at, submission_status, is_draft)
    `)
    .eq('assigned_date', date)

  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  } else if (userId) {
    query = query.eq('user_id', userId)
  } else if (teamId) {
    query = query.eq('users.team_id', teamId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data })
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { target_type, user_id, team_id, assigned_date, kras } = body

  if (!assigned_date || !kras?.length) {
    return NextResponse.json({ error: 'Date and at least one KRA are required' }, { status: 400 })
  }

  let targetUserIds = []

  if (target_type === 'individual') {
    if (!user_id) return NextResponse.json({ error: 'Employee is required' }, { status: 400 })
    targetUserIds = [user_id]
  } else if (target_type === 'team') {
    if (!team_id) return NextResponse.json({ error: 'Team is required' }, { status: 400 })
    const { data: teamMembers } = await supabase
      .from('users')
      .select('id')
      .eq('team_id', team_id)
      .eq('is_active', true)
    targetUserIds = teamMembers?.map((m) => m.id) ?? []
  }

  if (!targetUserIds.length) {
    return NextResponse.json({ error: 'No active employees found for target' }, { status: 400 })
  }

  const templatesInsert = kras.map((k) => ({
    title: k.title,
    kra_type: k.kra_type,
    target_value: k.kra_type === 'quantitative' ? k.target_value : null,
    description: k.description ?? null,
    is_recurring: k.is_recurring ?? false,
    created_by: user.id,
    team_id: target_type === 'team' ? team_id : null,
  }))

  const { data: templates, error: tmplError } = await supabase
    .from('kra_templates')
    .insert(templatesInsert)
    .select('id')

  if (tmplError) return NextResponse.json({ error: tmplError.message }, { status: 500 })

  const assignments = []
  for (const uid of targetUserIds) {
    for (const tmpl of templates) {
      assignments.push({
        kra_id: tmpl.id,
        user_id: uid,
        assigned_date,
        assigned_by: user.id,
      })
    }
  }

  const { error: assignError } = await supabase.from('kra_assignments').insert(assignments)
  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })

  return NextResponse.json({ success: true, assigned_count: assignments.length }, { status: 201 })
}
