'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { adAccountSchema } from '@/lib/validations/ads'
import { Plus, Edit2, PowerOff, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

function PlatformBadge({ platform }) {
  return platform === 'meta'
    ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Meta</span>
    : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Google</span>
}

export default function AdAccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [paidAdsEmployees, setPaidAdsEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState(null)
  const [banner, setBanner] = useState(null)

  const defaultValues = {
    platform: 'meta',
    account_name: '',
    account_ref_id: '',
    client_name: '',
    monthly_budget: 0,
    daily_lead_target: 0,
    assigned_user_ids: [],
  }

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(adAccountSchema),
    defaultValues,
  })

  async function loadData() {
    const [accRes, empRes] = await Promise.all([
      fetch('/api/ad-accounts').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
    setAccounts(accRes.accounts ?? [])
    setPaidAdsEmployees((empRes.employees ?? []).filter(e => e.is_paid_ads_member && e.is_active))
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditingAccount(null)
    reset(defaultValues)
    setDrawerOpen(true)
  }

  function openEdit(account) {
    setEditingAccount(account)
    reset({
      platform: account.platform,
      account_name: account.account_name,
      account_ref_id: account.account_ref_id ?? '',
      client_name: account.client_name,
      monthly_budget: parseFloat(account.monthly_budget) || 0,
      daily_lead_target: account.daily_lead_target || 0,
      assigned_user_ids: account.assigned_user_ids ?? [],
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingAccount(null)
  }

  function showBanner(type, message) {
    setBanner({ type, message })
    setTimeout(() => setBanner(null), 3500)
  }

  async function onSubmit(data) {
    setSaving(true)
    try {
      const url = editingAccount ? `/api/ad-accounts/${editingAccount.id}` : '/api/ad-accounts'
      const method = editingAccount ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, account_ref_id: data.account_ref_id || null }),
      })
      const json = await res.json()
      if (!res.ok) { showBanner('error', json.error ?? 'Save failed'); return }
      await loadData()
      closeDrawer()
      showBanner('success', editingAccount ? 'Account updated' : 'Account created')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(account) {
    if (!window.confirm(`Deactivate "${account.account_name}"? Employees will lose access.`)) return
    setDeactivatingId(account.id)
    const res = await fetch(`/api/ad-accounts/${account.id}`, { method: 'DELETE' })
    setDeactivatingId(null)
    if (res.ok) {
      setAccounts(prev => prev.filter(a => a.id !== account.id))
      showBanner('success', 'Account deactivated')
    } else {
      const json = await res.json()
      showBanner('error', json.error ?? 'Failed to deactivate')
    }
  }

  const activeAccounts = accounts.filter(a => a.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ad Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage paid advertising accounts and employee assignments</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Account
        </button>
      </div>

      {banner && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border ${
          banner.type === 'success'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {banner.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {banner.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : activeAccounts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-16 text-center">
          <p className="text-slate-400 text-sm">No active ad accounts yet. Click &quot;New Account&quot; to add one.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Platform</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Monthly Budget</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Daily Leads</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Assigned</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeAccounts.map(account => (
                <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{account.account_name}</p>
                    {account.account_ref_id && (
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{account.account_ref_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-3"><PlatformBadge platform={account.platform} /></td>
                  <td className="px-4 py-3 text-slate-700">{account.client_name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {Number(account.monthly_budget).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{account.daily_lead_target}</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {account.assigned_user_ids?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(account)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(account)}
                        disabled={deactivatingId === account.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Deactivate"
                      >
                        {deactivatingId === account.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <PowerOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeDrawer} />
          <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l border-slate-200 z-50 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-base font-semibold text-slate-900">
                {editingAccount ? 'Edit Account' : 'New Ad Account'}
              </h2>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Platform */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
                <Controller
                  name="platform"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {[
                        { value: 'meta', label: 'Meta', active: 'bg-blue-600 text-white border-blue-600' },
                        { value: 'google', label: 'Google', active: 'bg-red-600 text-white border-red-600' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`px-5 py-2 rounded-md text-sm font-medium border transition-colors ${
                            field.value === opt.value
                              ? opt.active
                              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                <input
                  {...register('account_name')}
                  placeholder="e.g. Acme Meta — Main"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.account_name && <p className="text-xs text-red-600 mt-1">{errors.account_name.message}</p>}
              </div>

              {/* Ref ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Account ID / Ref <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  {...register('account_ref_id')}
                  placeholder="e.g. act_123456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                <input
                  {...register('client_name')}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.client_name && <p className="text-xs text-red-600 mt-1">{errors.client_name.message}</p>}
              </div>

              {/* Budget + Lead Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Budget</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('monthly_budget', { valueAsNumber: true })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.monthly_budget && <p className="text-xs text-red-600 mt-1">{errors.monthly_budget.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Daily Lead Target</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    {...register('daily_lead_target', { valueAsNumber: true })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.daily_lead_target && <p className="text-xs text-red-600 mt-1">{errors.daily_lead_target.message}</p>}
                </div>
              </div>

              {/* Assigned Employees */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign to Employees
                  <span className="ml-1 text-xs font-normal text-slate-400">(Paid Ads members only)</span>
                </label>
                {paidAdsEmployees.length === 0 ? (
                  <p className="text-sm text-slate-400 px-3 py-4 border border-dashed border-slate-300 rounded-md">
                    No Paid Ads employees found. Mark employees as &quot;Paid Ads Member&quot; first.
                  </p>
                ) : (
                  <Controller
                    name="assigned_user_ids"
                    control={control}
                    render={({ field }) => (
                      <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
                        {paidAdsEmployees.map(emp => {
                          const checked = field.value?.includes(emp.id) ?? false
                          return (
                            <label key={emp.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current = field.value ?? []
                                  field.onChange(
                                    e.target.checked
                                      ? [...current, emp.id]
                                      : current.filter(id => id !== emp.id)
                                  )
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <p className="text-sm font-medium text-slate-700">{emp.full_name}</p>
                                {emp.teams?.team_name && (
                                  <p className="text-xs text-slate-400">{emp.teams.team_name}</p>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  />
                )}
                {errors.assigned_user_ids && (
                  <p className="text-xs text-red-600 mt-1">{errors.assigned_user_ids.message}</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex gap-3 flex-shrink-0">
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                  : editingAccount ? 'Update Account' : 'Create Account'}
              </button>
              <button
                onClick={closeDrawer}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
