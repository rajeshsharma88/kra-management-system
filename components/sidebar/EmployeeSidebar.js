'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CheckSquare,
  Megaphone,
  History,
  Lock,
  LogOut,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { formatDistanceToNow, isBefore } from 'date-fns'

export default function EmployeeSidebar({ user, cutoffTime, isPaidAds }) {
  const pathname = usePathname()
  const router = useRouter()
  const [timeDisplay, setTimeDisplay] = useState('')
  const [urgency, setUrgency] = useState('normal')

  useEffect(() => {
    if (!cutoffTime) return

    function updateTimer() {
      const now = new Date()
      const cutoff = new Date(cutoffTime)

      if (isBefore(cutoff, now)) {
        setTimeDisplay('Cutoff passed')
        setUrgency('passed')
        return
      }

      const diffMs = cutoff - now
      const diffMins = Math.floor(diffMs / 60000)
      const diffHrs = Math.floor(diffMins / 60)
      const remainMins = diffMins % 60

      if (diffMins < 15) {
        setUrgency('critical')
      } else if (diffMins < 60) {
        setUrgency('warning')
      } else {
        setUrgency('normal')
      }

      setTimeDisplay(diffHrs > 0 ? `${diffHrs}h ${remainMins}m` : `${diffMins}m`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 30000)
    return () => clearInterval(interval)
  }, [cutoffTime])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { label: "Today's KRAs", href: '/today', icon: CheckSquare },
    ...(isPaidAds ? [{ label: "Today's Ads Log", href: '/ads-log', icon: Megaphone }] : []),
    { label: 'My History', href: '/history', icon: History },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 border-r border-slate-700 flex flex-col z-40">
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700 flex-shrink-0">
        <span className="text-white font-bold text-lg">KRA Manager</span>
        {timeDisplay && (
          <div className="flex items-center gap-1">
            <Clock className={cn('w-4 h-4', urgency === 'critical' ? 'text-red-400' : urgency === 'warning' ? 'text-amber-400' : 'text-slate-400')} />
            <span
              className={cn(
                'text-xs',
                urgency === 'passed' && 'text-red-500 font-semibold',
                urgency === 'critical' && 'text-red-400 font-semibold animate-pulse',
                urgency === 'warning' && 'text-amber-400 font-medium',
                urgency === 'normal' && 'text-slate-400'
              )}
            >
              {timeDisplay}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-slate-800 text-white border-l-4 border-indigo-500 pl-2'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span className="hidden md:block">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-700 p-4 flex-shrink-0">
        {user && (
          <div className="mb-3 bg-slate-800 rounded-md px-3 py-2">
            <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{user.team_name}</p>
          </div>
        )}
        <div className="space-y-1">
          <Link
            href="/change-password"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <Lock className="w-5 h-5 text-slate-400" />
            <span className="hidden md:block">Change Password</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
            <span className="hidden md:block">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
