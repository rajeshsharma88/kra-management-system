'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Clock, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function TodayPage() {
  const [assignments, setAssignments] = useState([])
  const [logs, setLogs] = useState({})       // { [assignmentId]: { status, achieved_value, comments, is_draft, saved } }
  const [loading, setLoading] = useState(true)
  const [cutoff, setCutoff] = useState(null) // Date object
  const [isPastCutoff, setIsPastCutoff] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [savingIds, setSavingIds] = useState(new Set())
  const debounceTimers = useRef({})

  const today = todayStr()

  // Fetch assignments and settings on mount
  useEffect(() => {
    async function load() {
      const [kraRes, settingsRes] = await Promise.all([
        fetch(`/api/kras?date=${today}`),
        fetch('/api/settings'),
      ])
      const { assignments: a } = await kraRes.json()
      const { settings } = await settingsRes.json()

      const list = a ?? []
      setAssignments(list)

      // Build initial log state from existing kra_logs
      const initialLogs = {}
      list.forEach((asgn) => {
        const log = asgn.kra_logs?.[0]
        initialLogs[asgn.id] = {
          status: log?.status ?? '',
          achieved_value: log?.achieved_value != null ? String(log.achieved_value) : '',
          comments: log?.comments ?? '',
          is_draft: log?.is_draft ?? true,
          saved: !!log,
        }
      })
      setLogs(initialLogs)

      // Compute cutoff
      const cutoffStr = settings?.daily_cutoff_time ?? '19:00'
      const [h, m] = cutoffStr.split(':').map(Number)
      const now = new Date()
      const c = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
      setCutoff(c)
      setIsPastCutoff(now > c)
      setLoading(false)
    }
    load()
  }, [today])

  // Poll cutoff every 30s
  useEffect(() => {
    if (!cutoff) return
    const interval = setInterval(() => {
      setIsPastCutoff(new Date() > cutoff)
    }, 30000)
    return () => clearInterval(interval)
  }, [cutoff])

  function updateLog(assignmentId, field, value) {
    setLogs((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [field]: value, saved: false },
    }))
    scheduleDraftSave(assignmentId)
  }

  function scheduleDraftSave(assignmentId) {
    clearTimeout(debounceTimers.current[assignmentId])
    debounceTimers.current[assignmentId] = setTimeout(() => {
      saveDraft(assignmentId)
    }, 900)
  }

  const saveDraft = useCallback(
    async (assignmentId) => {
      const log = logs[assignmentId]
      if (!log?.status) return  // can't save without a status

      setSavingIds((prev) => new Set([...prev, assignmentId]))
      try {
        await fetch('/api/kra-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignmentId,
            log_date: today,
            status: log.status,
            achieved_value:
              log.achieved_value !== '' ? parseFloat(log.achieved_value) : null,
            comments: log.comments || null,
            is_draft: true,
          }),
        })
        setLogs((prev) => ({
          ...prev,
          [assignmentId]: { ...prev[assignmentId], saved: true },
        }))
      } catch {
        // silent — draft save failure is non-critical
      }
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(assignmentId)
        return next
      })
    },
    [logs, today]
  )

  async function submitAll() {
    if (isPastCutoff) return
    setSubmitting(true)

    const toSubmit = assignments.filter((a) => logs[a.id]?.status)
    await Promise.all(
      toSubmit.map((a) =>
        fetch('/api/kra-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: a.id,
            log_date: today,
            status: logs[a.id].status,
            achieved_value:
              logs[a.id].achieved_value !== ''
                ? parseFloat(logs[a.id].achieved_value)
                : null,
            comments: logs[a.id].comments || null,
            is_draft: false,
          }),
        })
      )
    )

    setLogs((prev) => {
      const next = { ...prev }
      toSubmit.forEach((a) => {
        next[a.id] = { ...next[a.id], is_draft: false, saved: true }
      })
      return next
    })

    setSubmitting(false)
    setSubmitted(true)
  }

  // Computed stats
  const total = assignments.length
  const loggedStatuses = assignments.map((a) => logs[a.id]?.status).filter(Boolean)
  const done = loggedStatuses.filter((s) => s === 'done').length
  const inProgress = loggedStatuses.filter((s) => s === 'in_progress').length
  const blocked = loggedStatuses.filter((s) => s === 'blocked').length
  const allSubmitted = total > 0 && assignments.every((a) => logs[a.id]?.is_draft === false)
  const logsWithStatus = assignments.filter((a) => logs[a.id]?.status).length
  const canSubmit = !isPastCutoff && !submitting && logsWithStatus > 0 && !allSubmitted

  const formattedDate = new Date(today + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Today&apos;s KRAs</h1>
        <p className="text-sm text-slate-400 mt-0.5">{formattedDate}</p>
      </div>

      {/* Cutoff banner */}
      {isPastCutoff && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Submission cutoff has passed. Your KRAs have been locked for today.
        </div>
      )}

      {/* All submitted banner */}
      {allSubmitted && !isPastCutoff && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          All KRAs submitted for today. Great work!
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MiniStatCard label="Total" value={total} color="slate" />
        <MiniStatCard label="Done" value={done} color="green" />
        <MiniStatCard label="In Progress" value={inProgress} color="amber" />
        <MiniStatCard label="Blocked" value={blocked} color="red" />
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No KRAs assigned for today.</p>
          <p className="text-xs text-slate-400 mt-1">Your admin will assign KRAs shortly.</p>
        </div>
      )}

      {/* KRA cards */}
      <div className="space-y-4">
        {assignments.map((asgn) => {
          const kra = asgn.kra_templates
          const log = logs[asgn.id] ?? {}
          const isSubmitted = log.is_draft === false
          const isSaving = savingIds.has(asgn.id)
          const pct =
            kra?.kra_type === 'quantitative' &&
            kra?.target_value &&
            log.achieved_value !== ''
              ? Math.min(100, Math.round((parseFloat(log.achieved_value || 0) / kra.target_value) * 100))
              : null

          return (
            <div
              key={asgn.id}
              className={cn(
                'bg-white border rounded-lg p-5 transition-all',
                isSubmitted
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-slate-200'
              )}
            >
              {/* KRA header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{kra?.title}</p>
                  {kra?.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{kra.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      kra?.kra_type === 'quantitative'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-violet-50 text-violet-600'
                    )}
                  >
                    {kra?.kra_type === 'quantitative' ? 'Quantitative' : 'Qualitative'}
                  </span>
                  {isSubmitted && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>

              {/* Quantitative achieved + progress */}
              {kra?.kra_type === 'quantitative' && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-xs font-medium text-slate-500 w-20 flex-shrink-0">
                      Achieved
                    </label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        disabled={isSubmitted || isPastCutoff}
                        value={log.achieved_value ?? ''}
                        onChange={(e) => updateLog(asgn.id, 'achieved_value', e.target.value)}
                        className="w-24 px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      {kra.target_value && (
                        <span className="text-xs text-slate-400">/ {kra.target_value}</span>
                      )}
                    </div>
                  </div>
                  {kra.target_value && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>{pct ?? 0}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            (pct ?? 0) >= 100
                              ? 'bg-green-500'
                              : (pct ?? 0) >= 50
                              ? 'bg-indigo-500'
                              : 'bg-amber-400'
                          )}
                          style={{ width: `${pct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status buttons */}
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-2">Status</p>
                <div className="flex gap-2">
                  {[
                    { value: 'done', label: 'Done', active: 'bg-green-600 text-white border-green-600', hover: 'hover:border-green-400' },
                    { value: 'in_progress', label: 'In Progress', active: 'bg-amber-500 text-white border-amber-500', hover: 'hover:border-amber-400' },
                    { value: 'blocked', label: 'Blocked', active: 'bg-red-500 text-white border-red-500', hover: 'hover:border-red-400' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isSubmitted || isPastCutoff}
                      onClick={() => updateLog(asgn.id, 'status', opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:cursor-not-allowed',
                        log.status === opt.value
                          ? opt.active
                          : `bg-white text-slate-500 border-slate-300 ${opt.hover}`,
                        (isSubmitted || isPastCutoff) && log.status !== opt.value && 'opacity-40'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div className="mb-3">
                <textarea
                  rows={2}
                  placeholder="Add a comment (optional)..."
                  disabled={isSubmitted || isPastCutoff}
                  value={log.comments ?? ''}
                  onChange={(e) => updateLog(asgn.id, 'comments', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-900 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              {/* Save indicator */}
              <div className="flex justify-end">
                {isSaving ? (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving draft...
                  </span>
                ) : log.saved && !isSubmitted ? (
                  <span className="text-xs text-slate-400">Draft saved</span>
                ) : isSubmitted ? (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Submitted
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Submit all button */}
      {total > 0 && (
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={submitAll}
            disabled={!canSubmit}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
              </span>
            ) : (
              `Submit All KRAs (${logsWithStatus}/${total})`
            )}
          </button>
          {isPastCutoff ? (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Cutoff passed
            </span>
          ) : allSubmitted ? (
            <span className="text-xs text-green-600">All submitted</span>
          ) : (
            <span className="text-xs text-slate-400">
              Drafts save automatically as you type.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStatCard({ label, value, color }) {
  const colorMap = {
    slate: 'text-slate-900 bg-white border-slate-200',
    green: 'text-green-700 bg-green-50 border-green-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    red: 'text-red-700 bg-red-50 border-red-200',
  }
  return (
    <div className={cn('border rounded-lg px-4 py-3 text-center', colorMap[color])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{label}</p>
    </div>
  )
}
