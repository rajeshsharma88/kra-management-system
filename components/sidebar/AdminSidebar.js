'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  BarChart2,
  Settings,
  Users,
  FileText,
  Lock,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Assign KRAs', href: '/assign-kras', icon: ClipboardList },
  { label: 'Ads Performance', href: '/ads-performance', icon: BarChart2 },
  { label: 'Ad Accounts', href: '/ad-accounts', icon: Settings },
  { label: 'Employees', href: '/employees', icon: Users },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function AdminSidebar({ user }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 border-r border-slate-700 flex flex-col z-40">
      <div className="h-16 flex items-center px-4 border-b border-slate-700 flex-shrink-0">
        <span className="text-white font-bold text-lg">KRA Manager</span>
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
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-indigo-600 mt-1">
              {user.role === 'owner' ? 'Owner' : 'Admin'}
            </span>
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
