import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar'

export default async function EmployeeLayout({ children }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, is_paid_ads_member, teams(team_name)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')
  if (profile.role === 'admin' || profile.role === 'owner') redirect('/dashboard')

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('setting_key, setting_value')

  const settings = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.setting_key, r.setting_value])
  )

  const cutoffTimeStr = settings.daily_cutoff_time ?? '19:00'
  const [hours, minutes] = cutoffTimeStr.split(':').map(Number)
  const today = new Date()
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0)

  const userWithTeam = {
    ...profile,
    team_name: profile.teams?.team_name ?? '',
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <EmployeeSidebar
        user={userWithTeam}
        cutoffTime={cutoff.toISOString()}
        isPaidAds={profile.is_paid_ads_member}
      />
      <main className="flex-1 overflow-y-auto ml-60">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
