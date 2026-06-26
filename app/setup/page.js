'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForm, useFieldArray } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, CheckCircle } from 'lucide-react'

const teamsSchema = z.object({
  teams: z.array(z.object({ team_name: z.string().min(1, 'Team name is required') })).min(1),
})

const employeesSchema = z.object({
  employees: z.array(z.object({
    full_name: z.string().min(1, 'Full name is required'),
    username: z.string().min(3, 'Min 3 characters').regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only'),
    password: z.string().min(8, 'Min 8 characters'),
    team_id: z.string().min(1, 'Select a team'),
    role: z.enum(['employee', 'admin', 'owner']),
    is_paid_ads_member: z.boolean(),
  })).min(1),
})

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [stepsComplete, setStepsComplete] = useState({ 1: false, 2: false })
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors_server, setErrors_server] = useState('')

  const teamsForm = useForm({
    resolver: zodResolver(teamsSchema),
    defaultValues: {
      teams: [
        { team_name: 'SEO' },
        { team_name: 'Paid Ads' },
        { team_name: 'Content' },
        { team_name: 'Design' },
      ],
    },
  })

  const { fields: teamFields, append: appendTeam, remove: removeTeam } = useFieldArray({
    control: teamsForm.control,
    name: 'teams',
  })

  const employeesForm = useForm({
    resolver: zodResolver(employeesSchema),
    defaultValues: {
      employees: [{ full_name: '', username: '', password: '', team_id: '', role: 'employee', is_paid_ads_member: false }],
    },
  })

  const { fields: employeeFields, append: appendEmployee, remove: removeEmployee } = useFieldArray({
    control: employeesForm.control,
    name: 'employees',
  })

  useEffect(() => {
    async function checkSetup() {
      const supabase = createClient()
      const { count } = await supabase.from('teams').select('id', { count: 'exact', head: true })
      if (count > 0) {
        const { data: savedTeams } = await supabase.from('teams').select('id, team_name')
        setTeams(savedTeams ?? [])
        setStepsComplete((p) => ({ ...p, 1: true }))
        setStep(2)
      }
    }
    checkSetup()
  }, [])

  async function saveTeams(data) {
    setLoading(true)
    setErrors_server('')

    const names = data.teams.map((t) => t.team_name.trim())
    const unique = new Set(names)
    if (unique.size !== names.length) {
      setErrors_server('Duplicate team names are not allowed.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/setup?action=teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: names }),
    })
    const json = await res.json()

    if (!res.ok) {
      setErrors_server(json.error ?? 'Failed to save teams. Please try again.')
      setLoading(false)
      return
    }

    setTeams(json.teams)
    setStepsComplete((p) => ({ ...p, 1: true }))
    setLoading(false)
    setStep(1)
  }

  async function saveEmployees(data) {
    setLoading(true)
    setErrors_server('')

    const usernames = data.employees.map((e) => e.username)
    const unique = new Set(usernames)
    if (unique.size !== usernames.length) {
      setErrors_server('Duplicate usernames are not allowed.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/setup?action=employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees: data.employees }),
    })
    const json = await res.json()

    if (!res.ok) {
      setErrors_server(json.error ?? 'Failed to create employees. Please try again.')
      setLoading(false)
      return
    }

    setStepsComplete((p) => ({ ...p, 2: true }))
    setLoading(false)
    setStep(1)
  }

  const stepCards = [
    { num: 1, label: 'Add Your Teams', description: 'Set up the teams in your agency' },
    { num: 2, label: 'Add Your Employees', description: 'Create accounts for your team members' },
    { num: 3, label: 'Assign First KRAs', description: 'Give your team their first goals' },
  ]

  if (step === 1) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Welcome to KRA Manager</h1>
            <p className="text-sm text-slate-500 mt-1">{"Let's get your workspace ready in 3 steps."}</p>
          </div>

          <div className="flex flex-col gap-4">
            {stepCards.map(({ num, label, description }) => {
              const isDone = stepsComplete[num]
              const isLocked = num === 2 && !stepsComplete[1] || num === 3 && !stepsComplete[2]
              const isCurrent = (num === 1 && !stepsComplete[1]) || (num === 2 && stepsComplete[1] && !stepsComplete[2]) || (num === 3 && stepsComplete[2])

              return (
                <div
                  key={num}
                  className={`bg-white rounded-lg shadow border p-6 flex items-center justify-between ${isLocked ? 'opacity-50 border-slate-200' : 'border-slate-200'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {isDone ? <CheckCircle className="w-5 h-5 text-green-600" /> : num}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500">{description}</p>
                    </div>
                  </div>
                  {!isDone && !isLocked && (
                    <button
                      onClick={() => num === 3 ? router.push('/assign-kras') : setStep(num + 1)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors duration-150"
                    >
                      {num === 3 ? 'Assign KRAs →' : `Start: ${label}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {stepsComplete[1] && stepsComplete[2] && (
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors duration-150"
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Add Your Teams</h2>
          <p className="text-sm text-slate-500 mb-6">Edit, add or remove teams before saving.</p>

          <form onSubmit={teamsForm.handleSubmit(saveTeams)}>
            <div className="flex flex-col gap-3 mb-4">
              {teamFields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    placeholder="Team name"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-150"
                    {...teamsForm.register(`teams.${i}.team_name`)}
                  />
                  {teamFields.length > 1 && (
                    <button type="button" onClick={() => removeTeam(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => appendTeam({ team_name: '' })}
              className="text-indigo-600 text-sm font-medium hover:bg-indigo-50 px-3 py-1.5 rounded-md transition-colors duration-150 flex items-center gap-1 mb-6"
            >
              <Plus className="w-4 h-4" /> Add Another Team
            </button>

            {errors_server && <p className="text-sm text-red-600 mb-4">{errors_server}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors duration-150 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Teams & Continue'}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (step === 2 || (step === 2 && stepsComplete[1])) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Add Your Employees</h2>
        <p className="text-sm text-slate-500 mb-6">Create accounts for your team members.</p>

        <form onSubmit={employeesForm.handleSubmit(saveEmployees)}>
          <div className="flex flex-col gap-6 mb-4">
            {employeeFields.map((field, i) => (
              <div key={field.id} className="border border-slate-200 rounded-md p-4 relative">
                {employeeFields.length > 1 && (
                  <button type="button" onClick={() => removeEmployee(i)} className="absolute top-3 right-3 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" {...employeesForm.register(`employees.${i}.full_name`)} />
                    {employeesForm.formState.errors.employees?.[i]?.full_name && (
                      <p className="mt-1 text-xs text-red-600">{employeesForm.formState.errors.employees[i].full_name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                    <input className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" {...employeesForm.register(`employees.${i}.username`)} />
                    {employeesForm.formState.errors.employees?.[i]?.username && (
                      <p className="mt-1 text-xs text-red-600">{employeesForm.formState.errors.employees[i].username.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                    <input type="password" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" {...employeesForm.register(`employees.${i}.password`)} />
                    {employeesForm.formState.errors.employees?.[i]?.password && (
                      <p className="mt-1 text-xs text-red-600">{employeesForm.formState.errors.employees[i].password.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
                    <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" {...employeesForm.register(`employees.${i}.team_id`)}>
                      <option value="">Select team...</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                    </select>
                    {employeesForm.formState.errors.employees?.[i]?.team_id && (
                      <p className="mt-1 text-xs text-red-600">{employeesForm.formState.errors.employees[i].team_id.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                    <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" {...employeesForm.register(`employees.${i}.role`)}>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input type="checkbox" id={`paid_ads_${i}`} className="w-4 h-4 text-indigo-600 rounded" {...employeesForm.register(`employees.${i}.is_paid_ads_member`)} />
                    <label htmlFor={`paid_ads_${i}`} className="text-sm font-medium text-slate-700">Paid Ads Member</label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => appendEmployee({ full_name: '', username: '', password: '', team_id: '', role: 'employee', is_paid_ads_member: false })}
            className="text-indigo-600 text-sm font-medium hover:bg-indigo-50 px-3 py-1.5 rounded-md transition-colors duration-150 flex items-center gap-1 mb-6"
          >
            <Plus className="w-4 h-4" /> Add Another Employee
          </button>

          {errors_server && <p className="text-sm text-red-600 mb-4">{errors_server}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Employees & Continue'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-md text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
