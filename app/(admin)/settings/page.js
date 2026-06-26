'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [cutoffTime, setCutoffTime] = useState('19:00')
  const [currency, setCurrency] = useState('INR')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ settings }) => {
        if (settings?.daily_cutoff_time) setCutoffTime(settings.daily_cutoff_time)
        if (settings?.currency) setCurrency(settings.currency)
        setLoading(false)
      })
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_cutoff_time: cutoffTime, currency }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Workspace-wide configuration</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            <div className="px-5 py-4 flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700 w-44 flex-shrink-0">
                Daily Cutoff Time
              </label>
              <div className="flex-1">
                <input
                  type="time"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Employees cannot submit KRAs after this time.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700 w-44 flex-shrink-0">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="AED">AED — UAE Dirham</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
