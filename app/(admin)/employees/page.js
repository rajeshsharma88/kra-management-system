'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { employeeSchema } from '@/lib/validations/employee'
import { Plus, X, Loader2 } from 'lucide-react'

const ROLE_LABELS = { employee: 'Employee', admin: 'Admin', owner: 'Owner' }

function RoleBadge({ role }) {
  const colors = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    employee: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[role] ?? colors.employee}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function Banner({ type, message, onClose }) {
  if (!message) return null
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg mb-4 text-sm ${
      type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'
    }`}>
      <span>{message}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </div>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState(null)

  const isEdit = !!editTarget

  const { register, handleSubmit, control, reset, formState: { errors }, setError } = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      full_name: '',
      username: '',
      password: '',
      team_id: '',
      role: 'employee',
      is_paid_ads_member: false,
    },
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [empRes, teamsRes] = await Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/teams').then(r => r.json()),
    ])
    setEmployees(empRes.employees ?? [])
    setTeams(teamsRes.teams ?? [])
    setLoading(false)
  }

  function showBanner(type, message) {
    setBanner({ type, message })
    setTimeout(() => setBanner(null), 3500)
  }

  function openAdd() {
    setEditTarget(null)
    reset({ full_name: '', username: '', password: '', team_id: '', role: 'employee', is_paid_ads_member: false })
    setDrawerOpen(true)
  }

  function openEdit(emp) {
    setEditTarget(emp)
    reset({
      full_name: emp.full_name,
      username: emp.username,
      password: '',
      team_id: emp.teams?.id ?? '',
      role: emp.role,
      is_paid_ads_member: emp.is_paid_ads_member ?? false,
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditTarget(null)
  }

  async function onSubmit(data) {
    if (!isEdit && (!data.password || data.password.length < 8)) {
      setError('password', { message: 'Password is required for new employees (min 8 characters)' })
      return
    }
    setSaving(true)
    try {
      let res
      if (isEdit) {
        const body = { id: editTarget.id, full_name: data.full_name, team_id: data.team_id, role: data.role, is_paid_ads_member: data.is_paid_ads_member }
        if (data.password) body.new_password = data.password
        res = await fetch('/api/employees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: data.full_name, username: data.username, password: data.password, team_id: data.team_id, role: data.role, is_paid_ads_member: data.is_paid_ads_member }),
        })
      }
      const json = await res.json()
      if (!res.ok) { showBanner('error', json.error ?? 'Something went wrong'); setSaving(false); return }
      await loadData()
      closeDrawer()
      showBanner('success', isEdit ? 'Employee updated successfully.' : 'Employee added successfully.')
    } catch {
      showBanner('error', 'Network error. Please try again.')
    }
    setSaving(false)
  }

  async function toggleActive(emp) {
    const verb = emp.is_active ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${verb} ${emp.full_name}?`)) return
    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: emp.id, is_active: !emp.is_active }),
    })
    if (res.ok) {
      await loadData()
      showBanner('success', `${emp.full_name} ${emp.is_active ? 'deactivated' : 'reactivated'}.`)
    } else {
      showBanner('error', 'Failed to update employee status.')
    }
  }

  const active = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage team members and their access</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <Banner type={banner?.type} message={banner?.message} onClose={() => setBanner(null)} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Active employees */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Active Employees</h2>
              <span className="text-xs text-slate-400">{active.length} member{active.length !== 1 ? 's' : ''}</span>
            </div>
            {active.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No active employees yet. Add one to get started.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Username</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Team</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Ads</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {active.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{emp.full_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.username}</td>
                      <td className="px-4 py-3 text-slate-600">{emp.teams?.team_name ?? '—'}</td>
                      <td className="px-4 py-3"><RoleBadge role={emp.role} /></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${emp.is_paid_ads_member ? 'bg-green-500' : 'bg-slate-300'}`} title={emp.is_paid_ads_member ? 'Yes' : 'No'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(emp)} className="text-xs text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-md transition-colors">Edit</button>
                          <button onClick={() => toggleActive(emp)} className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-md transition-colors">Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Inactive employees */}
          {inactive.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-500">Inactive</h2>
                <span className="text-xs text-slate-400">{inactive.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {inactive.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between px-4 py-3 opacity-60 hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-slate-700 w-40 truncate">{emp.full_name}</span>
                      <span className="font-mono text-xs text-slate-400">{emp.username}</span>
                      <span className="text-slate-400 hidden sm:block">{emp.teams?.team_name ?? '—'}</span>
                      <RoleBadge role={emp.role} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(emp)} className="text-xs text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-md transition-colors">Edit</button>
                      <button onClick={() => toggleActive(emp)} className="text-xs text-green-700 hover:text-green-800 border border-green-200 hover:border-green-300 px-2.5 py-1 rounded-md transition-colors">Reactivate</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Overlay */}
      {drawerOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={closeDrawer} />}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
          <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              {...register('full_name')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Jane Doe"
            />
            {errors.full_name && <p className="text-red-600 text-xs mt-1">{errors.full_name.message}</p>}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              {...register('username')}
              disabled={isEdit}
              className={`w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isEdit ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
              placeholder="jane_doe"
            />
            {errors.username && <p className="text-red-600 text-xs mt-1">{errors.username.message}</p>}
            {!isEdit && <p className="text-slate-400 text-xs mt-1">Lowercase letters, numbers, underscores only. Cannot be changed later.</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isEdit ? 'New Password' : 'Password'}
              {isEdit && <span className="text-slate-400 font-normal ml-1">(leave blank to keep current)</span>}
            </label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={isEdit ? 'Leave blank to keep current' : 'Min 8 characters'}
            />
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {/* Team */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Team</label>
            <select
              {...register('team_id')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select a team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
            </select>
            {errors.team_id && <p className="text-red-600 text-xs mt-1">{errors.team_id.message}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <div className="flex gap-2">
                  {['employee', 'admin', 'owner'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => field.onChange(r)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                        field.value === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.role && <p className="text-red-600 text-xs mt-1">{errors.role.message}</p>}
          </div>

          {/* Paid Ads Member */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <Controller
                control={control}
                name="is_paid_ads_member"
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={e => field.onChange(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-indigo-600"
                  />
                )}
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Paid Ads Team Member</span>
                <p className="text-xs text-slate-400 mt-0.5">Grants access to the Ads Log and Ad Accounts pages</p>
              </div>
            </label>
          </div>

          {/* Submit */}
          <div className="pt-2 pb-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
