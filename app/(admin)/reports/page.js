'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { subDays, format, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Download, FileText, Loader2 } from 'lucide-react'

function Section({ title, count, isOpen, onToggle, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen
            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {count != null && <span className="text-xs text-slate-400 ml-1">({count})</span>}
        </div>
      </button>
      {isOpen && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    on_time:       'bg-green-100 text-green-700',
    late:          'bg-amber-100 text-amber-700',
    missed:        'bg-red-100 text-red-700',
    achieved:      'bg-green-100 text-green-700',
    completed:     'bg-green-100 text-green-700',
    partial:       'bg-amber-100 text-amber-700',
    not_achieved:  'bg-red-100 text-red-700',
    not_completed: 'bg-red-100 text-red-700',
    not_submitted: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status?.replace(/_/g, ' ') ?? '—'}
    </span>
  )
}

function PlatformBadge({ platform }) {
  return platform === 'meta'
    ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Meta</span>
    : <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Google</span>
}

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = subDays(new Date(), 6).toISOString().split('T')[0]

  const [from, setFrom] = useState(weekAgo)
  const [to, setTo] = useState(today)
  const [kraData, setKraData] = useState([])
  const [adsData, setAdsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [openSections, setOpenSections] = useState(new Set(['kra', 'ads', 'summary']))

  function toggleSection(s) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/preview?from=${from}&to=${to}`)
      const data = await res.json()
      setKraData(data.kra ?? [])
      setAdsData(data.ads ?? [])
      setLoaded(true)
      setOpenSections(new Set(['kra', 'ads', 'summary']))
    } finally {
      setLoading(false)
    }
  }

  function triggerDownload(url) {
    const a = document.createElement('a')
    a.href = url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const employeeSummary = useMemo(() => {
    const map = {}
    for (const a of kraData) {
      const emp = a.users
      if (!emp) continue
      const key = emp.id ?? emp.full_name
      if (!map[key]) {
        map[key] = {
          name: emp.full_name,
          team: emp.teams?.team_name ?? '—',
          total: 0, achieved: 0, onTime: 0, late: 0, missed: 0,
        }
      }
      const log = a.kra_logs?.[0]
      map[key].total++
      if (log?.status === 'achieved' || log?.status === 'completed') map[key].achieved++
      if (log?.submission_status === 'on_time') map[key].onTime++
      if (log?.submission_status === 'late') map[key].late++
      if (log?.submission_status === 'missed') map[key].missed++
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  }, [kraData])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Export KRA and ads performance data</p>
        </div>
        {loaded && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerDownload(`/api/reports/csv?type=kra&from=${from}&to=${to}`)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors text-slate-700"
            >
              <Download className="w-3.5 h-3.5" /> KRA CSV
            </button>
            <button
              onClick={() => triggerDownload(`/api/reports/csv?type=ads&from=${from}&to=${to}`)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors text-slate-700"
            >
              <Download className="w-3.5 h-3.5" /> Ads CSV
            </button>
            <button
              onClick={() => triggerDownload(`/api/reports/pdf?from=${from}&to=${to}`)}
              title="Generates a PDF with both KRA and Ads data. May take 10–15 seconds."
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">To</label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Pre-generate placeholder */}
      {!loaded && !loading && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-16 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Select a date range and click Generate Report to preview data.</p>
        </div>
      )}

      {/* Three collapsible sections */}
      {loaded && (
        <div className="space-y-4">

          {/* 1 — KRA Performance */}
          <Section
            title="KRA Performance"
            count={kraData.length}
            isOpen={openSections.has('kra')}
            onToggle={() => toggleSection('kra')}
          >
            {kraData.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No KRA assignments in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Team</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">KRA</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Target</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Achieved</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Submission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kraData.map(a => {
                      const log = a.kra_logs?.[0]
                      return (
                        <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">{format(parseISO(a.assigned_date), 'd MMM yyyy')}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{a.users?.full_name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{a.users?.teams?.team_name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-700">{a.kra_templates?.title ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{a.kra_templates?.target_value ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-800">{log?.achieved_value ?? '—'}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={log?.status ?? 'not_submitted'} /></td>
                          <td className="px-4 py-2.5"><StatusBadge status={log?.submission_status ?? 'not_submitted'} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 2 — Ads Performance */}
          <Section
            title="Ads Performance"
            count={adsData.length}
            isOpen={openSections.has('ads')}
            onToggle={() => toggleSection('ads')}
          >
            {adsData.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No ads logs in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Account</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Spend</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Leads</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Conv.</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">ROAS</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Campaign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adsData.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">{format(parseISO(l.log_date), 'd MMM yyyy')}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {l.ad_accounts?.platform && <PlatformBadge platform={l.ad_accounts.platform} />}
                            <span className="font-medium text-slate-800">{l.ad_accounts?.account_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{l.users?.full_name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                          ₹{parseFloat(l.daily_spend_actual || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{l.leads_generated ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{l.conversions ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {l.roas != null
                            ? <span className={`font-medium ${parseFloat(l.roas) >= 1 ? 'text-green-700' : 'text-red-600'}`}>{parseFloat(l.roas).toFixed(2)}×</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-slate-600">{l.campaign_status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 3 — Employee Summary */}
          <Section
            title="Employee Summary"
            count={employeeSummary.length}
            isOpen={openSections.has('summary')}
            onToggle={() => toggleSection('summary')}
          >
            {employeeSummary.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No employee data in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Team</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">KRAs</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Achieved</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Achieve %</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">On Time</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Late</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Missed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeSummary.map((emp, i) => {
                      const achievePct = emp.total > 0 ? Math.round((emp.achieved / emp.total) * 100) : 0
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{emp.name}</td>
                          <td className="px-4 py-2.5 text-slate-500">{emp.team}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700">{emp.total}</td>
                          <td className="px-4 py-2.5 text-right text-green-700 font-medium">{emp.achieved}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-semibold ${achievePct >= 80 ? 'text-green-700' : achievePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {achievePct}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-700">{emp.onTime}</td>
                          <td className="px-4 py-2.5 text-right text-amber-600">{emp.late}</td>
                          <td className="px-4 py-2.5 text-right text-red-600">{emp.missed}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  )
}
