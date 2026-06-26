import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// TEMPORARY endpoint — delete this file after use
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const username = searchParams.get('username')
  const newPassword = searchParams.get('password')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!username || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Provide ?username=X&password=Y (min 8 chars)&secret=Z' }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const email = `${username}@kra.internal`

  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  const user = users.find(u => u.email === email)
  if (!user) return NextResponse.json({ error: `No auth user found for ${email}` }, { status: 404 })

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true, message: `Password updated for ${email}` })
}
