import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname === '/login' || pathname === '/change-password' || pathname === '/session-expired' || pathname === '/setup' || pathname === '/api/setup' || pathname.startsWith('/api/dev')
  const isSetupRoute = pathname.startsWith('/setup')
  const isAdminRoute = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/assign-kras') ||
    pathname.startsWith('/ads-performance') ||
    pathname.startsWith('/ad-accounts') ||
    pathname.startsWith('/employees') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings')
  const isEmployeeRoute = pathname.startsWith('/today') ||
    pathname.startsWith('/ads-log') ||
    pathname.startsWith('/history')

  if (!user && !isAuthRoute) {
    const hasSessionCookie = request.cookies.getAll().some(c => c.name.includes('-auth-token'))
    const dest = hasSessionCookie ? '/session-expired' : '/login'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (user && isAuthRoute) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin' || profile?.role === 'owner') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/today', request.url))
  }

  if (user && (isAdminRoute || isEmployeeRoute || isSetupRoute)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminOrOwner = profile?.role === 'admin' || profile?.role === 'owner'

    if (isAdminRoute && !isAdminOrOwner) {
      return NextResponse.redirect(new URL('/today', request.url))
    }
    if (isEmployeeRoute && isAdminOrOwner) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
