import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase.from('settings').select('setting_key, setting_value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const settings = Object.fromEntries((data ?? []).map((r) => [r.setting_key, r.setting_value]))
  return NextResponse.json({ settings })
}

export async function PATCH(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates = Object.entries(body)

  for (const [key, value] of updates) {
    await supabase
      .from('settings')
      .upsert({ setting_key: key, setting_value: String(value), updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' })
  }

  return NextResponse.json({ success: true })
}
