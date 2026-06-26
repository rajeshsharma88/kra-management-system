'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { subDays, format, parseISO } from 'date-fns'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Loader2 } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function PlatformBadge({ platform }) {
  return platform === 'meta'
    ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Meta</span>
    : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Google</span>
}

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } },
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
}

export default function AdsPerformancePage() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = subDays(new Date(), 6).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(weekAgo)
  const [endDate, setEndDate] = useState(today)
  const [platform, setPlatform] = useState('all')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('INR')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/ads-logs?start_date=${startDate}&end_date=${endDate}`).then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([logsData, settingsData]) => {
      setLogs(logsData.ads_logs ?? [])
      if (settingsData.settings?.currency) setCurrency(settingsData.settings.currency)
      setLoading(false)
    })
  }, [startDate, endDate])

  const sym = { INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'AED' }[currency] ?? currency

  const filteredLogs = useMemo(() => (
    platform === 'all' ? logs : logs.filter(l => l.ad_accounts?.platform === platform)
  ), [logs, platform])

  const { totalSpend, totalLeads, avgROAS, avgCPL } = useMemo(() => {
    const totalSpend = filteredLogs.reduce((s, l) => s + (parseFloat(l.daily_spend_actual) || 0), 0)
    const totalLeads = filteredLogs.reduce((s, l) => s + (parseInt(l.leads_generated) || 0), 0)
    const roasVals = filteredLogs.filter(l => l.roas).map(l => parseFloat(l.roas))
    const cplVals = filteredLogs.filter(l => l.cost_per_lead).map(l => parseFloat(l.cost_per_lead))
    const avgROAS = roasVals.length ? (roasVals.reduce((a, b) => a + b, 0) / roasVals.length) : null
    const avgCPL = cplVals.length ? (cplVals.reduce((a, b) => a + b, 0) / cplVals.length) : null
    return { totalSpend, totalLeads, avgROAS, avgCPL }
  }, [filteredLogs])

  const { accountRows } = useMemo(() => {
    const map = {}
    for (const log of filteredLogs) {
      const acc = log.ad_accounts
      if (!acc) continue
      if (!map[log.account_id]) {
        map[log.account_id] = {
          id: log.account_id,
          name: acc.account_name,
          platform: acc.platform,
          client: acc.client_name,
          spend: 0, leads: 0,
          roasSum: 0, roasCount: 0,
          cplSum: 0, cplCount: 0,
          days: 0,
        }
      }
      const d = map[log.account_id]
      d.spend += parseFloat(log.daily_spend_actual) || 0
      d.leads += parseInt(log.leads_generated) || 0
      if (log.roas) { d.roasSum += parseFloat(log.roas); d.roasCount++ }
      if (log.cost_per_lead) { d.cplSum += parseFloat(log.cost_per_lead); d.cplCount++ }
      d.days++
    }
    return { accountRows: Object.values(map).sort((a, b) => b.spend - a.spend) }
  }, [filteredLogs])

  const { sortedDates, dailySpend, dailyLeads } = useMemo(() => {
    const dailyMap = {}
    for (const log of filteredLogs) {
      if (!dailyMap[log.log_date]) dailyMap[log.log_date] = { spend: 0, leads: 0 }
      dailyMap[log.log_date].spend += parseFloat(log.daily_spend_actual) || 0
      dailyMap[log.log_date].leads += parseInt(log.leads_generated) || 0
    }
    const sortedDates = Object.keys(dailyMap).sort()
    return {
      sortedDates,
      dailySpend: sortedDates.map(d => dailyMap[d].spend),
      dailyLeads: sortedDates.map(d => dailyMap[d].leads),
    }
  }, [filteredLogs])

  const dateLabels = sortedDates.map(d => format(parseISO(d), 'dd MMM'))

  const spendChartData = {
    labels: dateLabels,
    datasets: [{
      label: 'Spend',
      data: dailySpend,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      fill: true,
      tension: 0.35,
      pointRadius: 3,
    }],
  }

  const leadsChartData = {
    labels: dateLabels,
    datasets: [{
      label: 'Leads',
      data: dailyLeads,
      backgroundColor: 'rgba(16,185,129,0.75)',
      borderRadius: 4,
    }],
  }

  return (
    <div>
      {/* Header + Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ads Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Paid ads metrics across all accounts</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform filter */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {['all', 'meta', 'google'].map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  platform === p ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-sm">—</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Spend"
              value={`${sym}${totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            />
            <StatCard
              label="Total Leads"
              value={totalLeads.toLocaleString()}
            />
            <StatCard
              label="Avg ROAS"
              value={avgROAS != null ? avgROAS.toFixed(2) : '—'}
            />
            <StatCard
              label="Avg CPL"
              value={avgCPL != null ? `${sym}${parseFloat(avgCPL).toFixed(0)}` : '—'}
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-16 text-center">
              <p className="text-slate-400 text-sm">No ads logs found for this date range and filter.</p>
            </div>
          ) : (
            <>
              {/* Charts */}
              {sortedDates.length > 1 && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Daily Spend ({sym})</p>
                    <div className="h-48">
                      <Line data={spendChartData} options={CHART_OPTIONS} />
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Daily Leads</p>
                    <div className="h-48">
                      <Bar data={leadsChartData} options={CHART_OPTIONS} />
                    </div>
                  </div>
                </div>
              )}

              {/* Per-account table */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">Per-Account Breakdown</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Account</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Days</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Total Spend</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Total Leads</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Avg ROAS</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Avg CPL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountRows.map(row => {
                      const rowROAS = row.roasCount ? (row.roasSum / row.roasCount).toFixed(2) : null
                      const rowCPL = row.cplCount ? (row.cplSum / row.cplCount).toFixed(0) : null
                      return (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <PlatformBadge platform={row.platform} />
                              <span className="font-medium text-slate-900">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.client}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{row.days}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {sym}{row.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-800">{row.leads.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {rowROAS != null
                              ? <span className={`font-medium ${parseFloat(rowROAS) >= 1 ? 'text-green-700' : 'text-red-600'}`}>{rowROAS}×</span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {rowCPL != null ? `${sym}${rowCPL}` : <span className="text-slate-400">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
