import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/sidebar/AdminSidebar'

export default async function AdminLayout({ children }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')
  if (profile.role === 'employee') redirect('/today')

  const { data: settings } = await supabase
    .from('settings')
    .select('setting_key, setting_value')

  const teamsCount = await supabase.from('teams').select('id', { count: 'exact', head: true })
  const hasTeams = (teamsCount.count ?? 0) > 0

  if (!hasTeams && !user.app_metadata?.setup_complete) {
    redirect('/setup')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <AdminSidebar user={profile} />
      <main className="flex-1 overflow-y-auto ml-60">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
