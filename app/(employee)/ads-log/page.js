'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { Loader2, CheckCircle2, AlertCircle, Save } from 'lucide-react'
import {
  calcBudgetUtilisation,
  calcLeadAchievement,
  calcCPL,
  calcCostPerConversion,
  calcROAS,
} from '@/lib/calculations'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function PlatformBadge({ platform }) {
  return platform === 'meta'
    ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Meta</span>
    : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Google</span>
}

function MetricTile({ label, value, highlight }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 text-center ${highlight ? 'bg-indigo-50' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-indigo-700' : 'text-slate-700'}`}>
        {value != null ? value : '—'}
      </p>
    </div>
  )
}

function computeDerived(log, leadTarget) {
  const spend = parseFloat(log.daily_spend_actual) || 0
  const budget = parseFloat(log.daily_budget_set) || 0
  const leads = parseInt(log.leads_generated) || 0
  const convs = parseInt(log.conversions) || 0
  const convVal = parseFloat(log.conversion_value) || 0
  return {
    budget_utilisation_pct: calcBudgetUtilisation(spend, budget),
    lead_achievement_pct: calcLeadAchievement(leads, leadTarget || 0),
    cost_per_lead: calcCPL(spend, leads),
    cost_per_conversion: calcCostPerConversion(spend, convs),
    roas: calcROAS(convVal, spend),
  }
}

const EMPTY_LOG = {
  daily_budget_set: '',
  daily_spend_actual: '',
  leads_generated: '',
  conversions: '',
  conversion_value: '',
  campaign_status: 'running',
  notes: '',
  saved: false,
  isSubmitted: false,
  budget_utilisation_pct: null,
  lead_achievement_pct: null,
  cost_per_lead: null,
  cost_per_conversion: null,
  roas: null,
}

export default function AdsLogPage() {
  const [accounts, setAccounts] = useState([])
  const [logs, setLogs] = useState({})
  const [cutoff, setCutoff] = useState(null)
  const [isPastCutoff, setIsPastCutoff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingIds, setSavingIds] = useState(new Set())
  const [currency, setCurrency] = useState('INR')
  const debounceTimers = useRef({})
  const logsRef = useRef({})
  const today = todayStr()

  useEffect(() => {
    Promise.all([
      fetch('/api/ad-accounts').then(r => r.json()),
      fetch(`/api/ads-logs?date=${today}`).then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([accountsData, logsData, settingsData]) => {
      const accs = accountsData.accounts ?? []
      const existingLogs = logsData.ads_logs ?? []
      const settings = settingsData.settings ?? {}

      if (settings.currency) setCurrency(settings.currency)

      const cutoffStr = settings.daily_cutoff_time ?? '19:00'
      const [h, m] = cutoffStr.split(':').map(Number)
      const now = new Date()
      const c = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
      setCutoff(c)
      setIsPastCutoff(now > c)
      setAccounts(accs)

      const initialLogs = {}
      for (const acc of accs) {
        const existing = existingLogs.find(l => l.account_id === acc.id)
        if (existing) {
          const log = {
            daily_budget_set: existing.daily_budget_set ?? '',
            daily_spend_actual: existing.daily_spend_actual ?? '',
            leads_generated: existing.leads_generated ?? '',
            conversions: existing.conversions ?? '',
            conversion_value: existing.conversion_value ?? '',
            campaign_status: existing.campaign_status ?? 'running',
            notes: existing.notes ?? '',
            saved: !existing.is_draft,
            isSubmitted: !existing.is_draft,
          }
          initialLogs[acc.id] = { ...log, ...computeDerived(log, acc.daily_lead_target) }
        } else {
          initialLogs[acc.id] = { ...EMPTY_LOG }
        }
      }
      setLogs(initialLogs)
      logsRef.current = initialLogs
      setLoading(false)
    })
  }, [today])

  useEffect(() => {
    if (!cutoff) return
    const interval = setInterval(() => setIsPastCutoff(new Date() > cutoff), 30000)
    return () => clearInterval(interval)
  }, [cutoff])

  const saveDraft = useCallback(async (accountId) => {
    const log = logsRef.current[accountId]
    if (!log || log.isSubmitted) return

    setSavingIds(prev => new Set([...prev, accountId]))
    try {
      await fetch('/api/ads-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          log_date: today,
          daily_budget_set: parseFloat(log.daily_budget_set) || 0,
          daily_spend_actual: parseFloat(log.daily_spend_actual) || 0,
          leads_generated: parseInt(log.leads_generated) || 0,
          conversions: parseInt(log.conversions) || 0,
          conversion_value: parseFloat(log.conversion_value) || 0,
          campaign_status: log.campaign_status || 'running',
          notes: log.notes || null,
          is_draft: true,
        }),
      })
      setLogs(prev => {
        const next = { ...prev, [accountId]: { ...prev[accountId], saved: true } }
        logsRef.current = next
        return next
      })
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(accountId); return s })
    }
  }, [today])

  function scheduleDraftSave(accountId) {
    clearTimeout(debounceTimers.current[accountId])
    debounceTimers.current[accountId] = setTimeout(() => saveDraft(accountId), 900)
  }

  function updateLog(accountId, field, value, leadTarget) {
    setLogs(prev => {
      const updated = { ...prev[accountId], [field]: value, saved: false }
      const next = { ...prev, [accountId]: { ...updated, ...computeDerived(updated, leadTarget) } }
      logsRef.current = next
      return next
    })
    scheduleDraftSave(accountId)
  }

  async function submitAccount(accountId, leadTarget) {
    const log = logsRef.current[accountId]
    if (!log || log.isSubmitted || isPastCutoff) return

    setSavingIds(prev => new Set([...prev, accountId]))
    try {
      const res = await fetch('/api/ads-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          log_date: today,
          daily_budget_set: parseFloat(log.daily_budget_set) || 0,
          daily_spend_actual: parseFloat(log.daily_spend_actual) || 0,
          leads_generated: parseInt(log.leads_generated) || 0,
          conversions: parseInt(log.conversions) || 0,
          conversion_value: parseFloat(log.conversion_value) || 0,
          campaign_status: log.campaign_status || 'running',
          notes: log.notes || null,
          is_draft: false,
        }),
      })
      if (res.ok) {
        setLogs(prev => {
          const next = { ...prev, [accountId]: { ...prev[accountId], isSubmitted: true, saved: true } }
          logsRef.current = next
          return next
        })
      }
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(accountId); return s })
    }
  }

  async function submitAll() {
    setSubmitting(true)
    await Promise.all(
      accounts
        .filter(acc => !logs[acc.id]?.isSubmitted)
        .map(acc => submitAccount(acc.id, acc.daily_lead_target))
    )
    setSubmitting(false)
  }

  const sym = { INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'AED' }[currency] ?? currency

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Today&apos;s Ads Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
        </div>
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-16 text-center">
          <p className="text-slate-400 text-sm">No ad accounts assigned to you yet. Ask your admin to assign accounts.</p>
        </div>
      </div>
    )
  }

  const submittedCount = accounts.filter(acc => logs[acc.id]?.isSubmitted).length
  const allSubmitted = submittedCount === accounts.length

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Today&apos;s Ads Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{submittedCount}/{accounts.length} submitted</span>
          <button
            onClick={submitAll}
            disabled={submitting || isPastCutoff || allSubmitted}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting
              ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</span>
              : allSubmitted ? 'All Submitted' : 'Submit All Logs'}
          </button>
        </div>
      </div>

      {isPastCutoff && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
          <AlertCircle className="w-4 h-4" /> Cutoff has passed. Logs are now locked.
        </div>
      )}
      {allSubmitted && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> All ad logs submitted for today.
        </div>
      )}

      <div className="space-y-6">
        {accounts.map(account => {
          const log = logs[account.id] ?? EMPTY_LOG
          const isSubmitted = log.isSubmitted
          const isSaving = savingIds.has(account.id)
          const disabled = isSubmitted || isPastCutoff

          return (
            <div key={account.id} className={`bg-white border rounded-xl overflow-hidden ${isSubmitted ? 'border-green-200' : 'border-slate-200'}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={account.platform} />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{account.account_name}</h3>
                    <p className="text-xs text-slate-400">
                      {account.client_name}{account.account_ref_id ? ` · ${account.account_ref_id}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isSaving && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                    </span>
                  )}
                  {!isSaving && log.saved && !isSubmitted && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Save className="w-3 h-3" /> Draft saved
                    </span>
                  )}
                  {isSubmitted && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Submitted
                    </span>
                  )}
                  {!isSubmitted && !isPastCutoff && (
                    <button
                      onClick={() => submitAccount(account.id, account.daily_lead_target)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* Budget & Spend */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Budget & Spend</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Budget Set ({sym})</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={log.daily_budget_set}
                        onChange={e => updateLog(account.id, 'daily_budget_set', e.target.value, account.daily_lead_target)}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Actual Spend ({sym})</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={log.daily_spend_actual}
                        onChange={e => updateLog(account.id, 'daily_spend_actual', e.target.value, account.daily_lead_target)}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0"
                      />
                    </div>
                    <MetricTile
                      label="Budget Util %"
                      value={log.budget_utilisation_pct != null ? `${log.budget_utilisation_pct}%` : null}
                      highlight={parseFloat(log.budget_utilisation_pct) > 100}
                    />
                  </div>
                </div>

                {/* Leads */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Leads</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Leads Generated</label>
                      <input
                        type="number" min="0" step="1"
                        value={log.leads_generated}
                        onChange={e => updateLog(account.id, 'leads_generated', e.target.value, account.daily_lead_target)}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Daily Target</label>
                      <input
                        type="number"
                        value={account.daily_lead_target}
                        readOnly
                        className="w-full px-3 py-2 border border-slate-100 rounded-md text-sm bg-slate-50 text-slate-500 cursor-default"
                      />
                    </div>
                    <MetricTile
                      label="Lead Achievement %"
                      value={log.lead_achievement_pct != null ? `${log.lead_achievement_pct}%` : null}
                      highlight={parseFloat(log.lead_achievement_pct) >= 100}
                    />
                  </div>
                </div>

                {/* Conversions & ROAS */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Conversions & ROAS</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Conversions</label>
                      <input
                        type="number" min="0" step="1"
                        value={log.conversions}
                        onChange={e => updateLog(account.id, 'conversions', e.target.value, account.daily_lead_target)}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Conversion Value ({sym})</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={log.conversion_value}
                        onChange={e => updateLog(account.id, 'conversion_value', e.target.value, account.daily_lead_target)}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricTile label={`CPL (${sym})`} value={log.cost_per_lead} />
                    <MetricTile label={`Cost/Conv (${sym})`} value={log.cost_per_conversion} />
                    <MetricTile label="ROAS" value={log.roas} highlight={parseFloat(log.roas) >= 1} />
                  </div>
                </div>

                {/* Campaign Status */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Campaign Status</p>
                  <div className="flex gap-2">
                    {[
                      { value: 'running', label: 'Running', active: 'bg-green-600 text-white border-green-600' },
                      { value: 'paused', label: 'Paused', active: 'bg-amber-500 text-white border-amber-500' },
                      { value: 'issue', label: 'Issue', active: 'bg-red-600 text-white border-red-600' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateLog(account.id, 'campaign_status', opt.value, account.daily_lead_target)}
                        disabled={disabled}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                          log.campaign_status === opt.value
                            ? opt.active
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes {log.campaign_status === 'issue' && <span className="text-red-500">— describe the issue</span>}
                    <span className="text-slate-400 font-normal"> (optional)</span>
                  </label>
                  <textarea
                    value={log.notes}
                    onChange={e => updateLog(account.id, 'notes', e.target.value, account.daily_lead_target)}
                    disabled={disabled}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 resize-none"
                    placeholder="Any notes or issue description..."
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
