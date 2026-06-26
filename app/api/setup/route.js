import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// POST /api/setup?action=teams  — create initial teams (only if none exist)
// POST /api/setup?action=employees — create initial employees (only if no users exist)
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const adminClient = getAdminClient()

  if (action === 'teams') {
    // Guard: only allowed when no teams exist yet
    const { count } = await adminClient
      .from('teams')
      .select('id', { count: 'exact', head: true })

    if (count > 0) {
      return NextResponse.json({ error: 'Setup already complete.' }, { status: 403 })
    }

    const body = await request.json()
    const names = (body.teams ?? []).map((n) => n.trim()).filter(Boolean)

    if (names.length === 0) {
      return NextResponse.json({ error: 'At least one team is required.' }, { status: 400 })
    }

    const unique = new Set(names)
    if (unique.size !== names.length) {
      return NextResponse.json({ error: 'Duplicate team names are not allowed.' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('teams')
      .insert(names.map((team_name) => ({ team_name })))
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ teams: data })
  }

  if (action === 'employees') {
    // Guard: only allowed when no users exist yet
    const { count } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })

    if (count > 0) {
      return NextResponse.json({ error: 'Setup already complete.' }, { status: 403 })
    }

    const body = await request.json()
    const employees = body.employees ?? []

    if (employees.length === 0) {
      return NextResponse.json({ error: 'At least one employee is required.' }, { status: 400 })
    }

    const usernames = employees.map((e) => e.username)
    if (new Set(usernames).size !== usernames.length) {
      return NextResponse.json({ error: 'Duplicate usernames are not allowed.' }, { status: 400 })
    }

    const created = []
    for (const emp of employees) {
      const email = `${emp.username}@kra.internal`

      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: emp.password,
        email_confirm: true,
      })

      if (authError) {
        // Roll back already-created users
        for (const u of created) await adminClient.auth.admin.deleteUser(u)
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }

      const { error: insertError } = await adminClient.from('users').insert({
        id: authUser.user.id,
        full_name: emp.full_name,
        username: emp.username,
        role: emp.role,
        team_id: emp.team_id,
        is_paid_ads_member: emp.is_paid_ads_member ?? false,
        is_active: true,
      })

      if (insertError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        for (const u of created) await adminClient.auth.admin.deleteUser(u)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      created.push(authUser.user.id)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
