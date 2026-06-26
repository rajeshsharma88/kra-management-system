'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

function SubmissionBadge({ status }) {
  const map = {
    on_time: { label: 'On Time', cls: 'bg-green-100 text-green-700' },
    late:    { label: 'Late',    cls: 'bg-amber-100 text-amber-700' },
    missed:  { label: 'Missed', cls: 'bg-red-100 text-red-700' },
  }
  const c = map[status] ?? { label: status ?? '—', cls: 'bg-slate-100 text-slate-600' }
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.cls}`}>{c.label}</span>
}

function KraStatusBadge({ status }) {
  const map = {
    achieved:      'bg-green-100 text-green-700',
    partial:       'bg-amber-100 text-amber-700',
    not_achieved:  'bg-red-100 text-red-700',
    completed:     'bg-green-100 text-green-700',
    not_completed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status?.replace(/_/g, ' ') ?? '—'}
    </span>
  )
}

function DayRow({ entry, isOpen, onToggle }) {
  const { date, logs } = entry
  const onTimeCount = logs.filter(l => l.submission_status === 'on_time').length
  const lateCount   = logs.filter(l => l.submission_status === 'late').length
  const missedCount = logs.filter(l => l.submission_status === 'missed').length
  const overallStatus = missedCount > 0 ? 'missed' : lateCount > 0 ? 'late' : 'on_time'

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isOpen
            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {format(parseISO(date), 'EEEE, d MMMM yyyy')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{logs.length} KRA{logs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onTimeCount > 0 && <span className="text-xs text-green-600 font-medium hidden sm:block">{onTimeCount} on time</span>}
          {lateCount > 0   && <span className="text-xs text-amber-600 font-medium hidden sm:block">{lateCount} late</span>}
          {missedCount > 0 && <span className="text-xs text-red-600 font-medium hidden sm:block">{missedCount} missed</span>}
          <SubmissionBadge status={overallStatus} />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {logs.map(log => {
            const tmpl = log.kra_assignments?.kra_templates
            return (
              <div key={log.id} className="px-4 py-3 bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{tmpl?.title ?? 'KRA'}</p>
                    {tmpl?.kra_type === 'quantitative' && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Target: <span className="font-medium">{tmpl.target_value ?? '—'}</span>
                        {' · '}
                        Achieved: <span className="font-medium">{log.achieved_value ?? '—'}</span>
                      </p>
                    )}
                    {log.comments && (
                      <p className="text-xs text-slate-400 mt-1 italic">&ldquo;{log.comments}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <KraStatusBadge status={log.status} />
                    <SubmissionBadge status={log.submission_status} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDates, setOpenDates] = useState(new Set())

  useEffect(() => {
    fetch('/api/kra-history')
      .then(r => r.json())
      .then(data => {
        const h = data.history ?? []
        setHistory(h)
        if (h.length) setOpenDates(new Set([h[0].date]))
        setLoading(false)
      })
  }, [])

  function toggleDate(date) {
    setOpenDates(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  const totalDays   = history.length
  const onTimeDays  = history.filter(e => e.logs.every(l => l.submission_status === 'on_time')).length
  const missedDays  = history.filter(e => e.logs.some(l => l.submission_status === 'missed')).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My History</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your past KRA submissions</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-16 text-center">
          <p className="text-slate-400 text-sm">No past submissions yet. Complete today&apos;s KRAs and check back tomorrow!</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Days Logged</p>
              <p className="text-2xl font-bold text-slate-900">{totalDays}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500 mb-1">On-Time Days</p>
              <p className="text-2xl font-bold text-green-700">{onTimeDays}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Days with Missed</p>
              <p className="text-2xl font-bold text-red-600">{missedDays}</p>
            </div>
          </div>

          {/* Date accordion list */}
          <div className="space-y-3">
            {history.map(entry => (
              <DayRow
                key={entry.date}
                entry={entry}
                isOpen={openDates.has(entry.date)}
                onToggle={() => toggleDate(entry.date)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
