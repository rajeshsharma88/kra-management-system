'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  ChevronRight,
  Users,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayStr())
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [employees, setEmployees] = useState([])
  const [assignments, setAssignments] = useState([])
  const [teams, setTeams] = useState([])
  const [loadingEmps, setLoadingEmps] = useState(true)
  const [loadingKras, setLoadingKras] = useState(true)
  const [drawerEmployee, setDrawerEmployee] = useState(null)

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then(({ employees: emps }) => {
        const active = (emps ?? []).filter((e) => e.role === 'employee' && e.is_active)
        setEmployees(active)
        const teamMap = {}
        active.forEach((e) => {
          if (e.teams?.id) teamMap[e.teams.id] = e.teams.team_name
        })
        setTeams(Object.entries(teamMap).map(([id, team_name]) => ({ id, team_name })))
        setLoadingEmps(false)
      })
      .catch(() => setLoadingEmps(false))
  }, [])

  const fetchAssignments = useCallback(() => {
    setLoadingKras(true)
    fetch(`/api/kras?date=${date}`)
      .then((r) => r.json())
      .then(({ assignments: a }) => {
        setAssignments(a ?? [])
        setLoadingKras(false)
      })
      .catch(() => setLoadingKras(false))
  }, [date])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Group assignments by user_id
  const assignmentsByUser = {}
  assignments.forEach((a) => {
    const uid = a.users?.id
    if (!uid) return
    if (!assignmentsByUser[uid]) assignmentsByUser[uid] = []
    assignmentsByUser[uid].push(a)
  })

  const filteredEmployees = employees.filter((e) =>
    selectedTeam === 'all' ? true : e.teams?.id === selectedTeam
  )

  const employeeRows = filteredEmployees.map((emp) => {
    const empAssignments = assignmentsByUser[emp.id] ?? []
    const total = empAssignments.length
    const logs = empAssignments.map((a) => a.kra_logs?.[0]).filter(Boolean)
    const done = logs.filter((l) => l.status === 'done').length
    const inProgress = logs.filter((l) => l.status === 'in_progress').length
    const blocked = logs.filter((l) => l.status === 'blocked').length
    const submitted = logs.filter((l) => !l.is_draft).length
    const score = total > 0 ? Math.round((done / total) * 100) : null
    return { ...emp, total, done, inProgress, blocked, submitted, score, assignments: empAssignments }
  })

  const totalEmployees = filteredEmployees.length
  const totalKras = employeeRows.reduce((s, e) => s + e.total, 0)
  const totalSubmitted = employeeRows.reduce((s, e) => s + e.submitted, 0)
  const scoredEmployees = employeeRows.filter((e) => e.total > 0)
  const avgScore =
    scoredEmployees.length > 0
      ? Math.round(scoredEmployees.reduce((s, e) => s + (e.score ?? 0), 0) / scoredEmployees.length)
      : 0

  const loading = loadingEmps || loadingKras

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Team KRA overview</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex gap-6">
        {/* Team filter */}
        <aside className="w-44 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Teams
          </p>
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => setSelectedTeam('all')}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  selectedTeam === 'all'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                All Teams
              </button>
            </li>
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedTeam(t.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    selectedTeam === t.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {t.team_name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard icon={Users} label="Active Employees" value={totalEmployees} color="indigo" />
            <StatCard icon={ClipboardList} label="KRAs Today" value={totalKras} color="slate" />
            <StatCard
              icon={CheckCircle2}
              label="Submitted"
              value={totalSubmitted}
              color="green"
            />
            <StatCard icon={TrendingUp} label="Avg Score" value={`${avgScore}%`} color="amber" />
          </div>

          {/* Employee table */}
          {loading ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Loading...
            </div>
          ) : employeeRows.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-500 text-sm">No employees found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Team</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">KRAs</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Done</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      In Progress
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Blocked</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Score</th>
                    <th className="w-8 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeRows.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setDrawerEmployee(emp)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{emp.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {emp.teams?.team_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {emp.total || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.done > 0 ? (
                          <span className="text-green-600 font-medium">{emp.done}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.inProgress > 0 ? (
                          <span className="text-amber-500 font-medium">{emp.inProgress}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.blocked > 0 ? (
                          <span className="text-red-500 font-medium">{emp.blocked}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.total > 0 ? (
                          <ScoreBadge score={emp.score} />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Employee KRA Drawer — ADMIN-02 */}
      {drawerEmployee && (
        <EmployeeDrawer
          employee={drawerEmployee}
          date={date}
          onClose={() => setDrawerEmployee(null)}
        />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center mb-3',
          colorMap[color]
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function ScoreBadge({ score }) {
  const color =
    score >= 80
      ? 'bg-green-100 text-green-700'
      : score >= 50
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        color
      )}
    >
      {score}%
    </span>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  const map = {
    done: 'bg-green-100 text-green-700',
    in_progress: 'bg-amber-100 text-amber-700',
    blocked: 'bg-red-100 text-red-700',
  }
  const labels = { done: 'Done', in_progress: 'In Progress', blocked: 'Blocked' }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', map[status])}>
      {labels[status]}
    </span>
  )
}

function EmployeeDrawer({ employee, date, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{employee.full_name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {employee.teams?.team_name ?? 'No team'} &middot; {date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KRA list */}
        <div className="flex-1 overflow-y-auto p-5">
          {employee.assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No KRAs assigned for this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employee.assignments.map((a) => {
                const kra = a.kra_templates
                const log = a.kra_logs?.[0]
                const pct =
                  kra?.kra_type === 'quantitative' &&
                  kra?.target_value &&
                  log?.achieved_value != null
                    ? Math.min(100, Math.round((log.achieved_value / kra.target_value) * 100))
                    : null

                return (
                  <div key={a.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 leading-snug">
                          {kra?.title}
                        </p>
                        {kra?.kra_type === 'quantitative' && kra?.target_value && (
                          <p className="text-xs text-slate-400 mt-0.5">Target: {kra.target_value}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                          kra?.kra_type === 'quantitative'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-violet-50 text-violet-600'
                        )}
                      >
                        {kra?.kra_type === 'quantitative' ? 'Quant' : 'Qual'}
                      </span>
                    </div>

                    {log ? (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={log.status} />
                          {log.is_draft && (
                            <span className="text-xs text-amber-500 font-medium">Draft</span>
                          )}
                        </div>

                        {pct !== null && (
                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Achieved: {log.achieved_value}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {log.comments && (
                          <p className="text-xs text-slate-500 bg-white border border-slate-100 rounded px-2 py-1.5">
                            {log.comments}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-400">Not logged yet</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer score */}
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Today&apos;s Score</span>
            {employee.total > 0 ? (
              <ScoreBadge score={employee.score} />
            ) : (
              <span className="text-sm text-slate-400">No KRAs assigned</span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
