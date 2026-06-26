import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// TEMPORARY debug endpoint — delete after use
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const adminClient = createAdminClient(url, serviceKey)

  // List users to confirm the user exists and their status
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()
  const user = users?.find(u => u.email === 'rajesh72sharma@kra.internal')

  // Try signing in with the known password
  const browserClient = createBrowserClient(url, anonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
  const { data: signInData, error: signInError } = await browserClient.auth.signInWithPassword({
    email: 'rajesh72sharma@kra.internal',
    password: 'Test12345',
  })

  return NextResponse.json({
    supabase_url: url?.substring(0, 30) + '...',
    anon_key_set: !!anonKey,
    service_key_set: !!serviceKey,
    user_found: !!user,
    user_email_confirmed: user?.email_confirmed_at ?? null,
    user_banned: user?.banned_until ?? null,
    sign_in_error: signInError?.message ?? null,
    sign_in_success: !!signInData?.session,
  })
}
