'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kraAssignmentSchema } from '@/lib/validations/kra'
import { Plus, Trash2, Copy, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

const defaultKra = () => ({
  title: '',
  kra_type: 'qualitative',
  target_value: '',
  description: '',
  is_recurring: false,
})

export default function AssignKrasPage() {
  const [employees, setEmployees] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(kraAssignmentSchema),
    defaultValues: {
      target_type: 'individual',
      user_id: '',
      team_id: '',
      assigned_date: todayStr(),
      kras: [defaultKra()],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'kras' })
  const targetType = watch('target_type')
  const userId = watch('user_id')
  const teamId = watch('team_id')
  const assignedDate = watch('assigned_date')
  const kras = watch('kras')

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then(({ employees: emps }) => {
        const active = (emps ?? []).filter((e) => e.is_active)
        setEmployees(active)
        const teamMap = {}
        active.forEach((e) => {
          if (e.teams?.id) teamMap[e.teams.id] = e.teams.team_name
        })
        setTeams(Object.entries(teamMap).map(([id, team_name]) => ({ id, team_name })))
      })
  }, [])

  async function copyFromYesterday() {
    const params = new URLSearchParams({ date: yesterdayStr() })
    if (targetType === 'individual' && userId) params.set('user_id', userId)

    setCopyLoading(true)
    try {
      const res = await fetch(`/api/kras?${params}`)
      const { assignments } = await res.json()

      if (!assignments?.length) {
        setServerError('No KRAs found for yesterday.')
        setCopyLoading(false)
        return
      }

      // Deduplicate by title
      const seen = new Set()
      const kraRows = []
      for (const a of assignments) {
        const t = a.kra_templates
        if (t && !seen.has(t.title)) {
          seen.add(t.title)
          kraRows.push({
            title: t.title,
            kra_type: t.kra_type,
            target_value: t.target_value != null ? String(t.target_value) : '',
            description: t.description ?? '',
            is_recurring: false,
          })
        }
      }

      setValue('kras', kraRows)
      setServerError('')
    } catch {
      setServerError('Failed to copy KRAs from yesterday.')
    }
    setCopyLoading(false)
  }

  async function onSubmit(data) {
    setLoading(true)
    setServerError('')
    setSuccess(false)

    const payload = {
      ...data,
      kras: data.kras.map((k) => ({
        ...k,
        target_value:
          k.kra_type === 'quantitative' && k.target_value !== ''
            ? parseFloat(k.target_value)
            : null,
      })),
    }

    const res = await fetch('/api/kras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) {
      setServerError(json.error ?? 'Failed to assign KRAs.')
      setLoading(false)
      return
    }

    setSuccess(true)
    reset({
      target_type: 'individual',
      user_id: '',
      team_id: '',
      assigned_date: todayStr(),
      kras: [defaultKra()],
    })
    setLoading(false)
    setTimeout(() => setSuccess(false), 4000)
  }

  const canCopy =
    (targetType === 'individual' && userId) || (targetType === 'team' && teamId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Assign KRAs</h1>
        <p className="text-sm text-slate-500 mt-0.5">Create and assign daily KRAs to employees or teams</p>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          KRAs assigned successfully!
        </div>
      )}

      {serverError && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {/* Date */}
          <div className="px-5 py-4 flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700 w-28 flex-shrink-0">
              Assign Date
            </label>
            <input
              type="date"
              className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              {...register('assigned_date')}
            />
            {errors.assigned_date && (
              <p className="text-xs text-red-600">{errors.assigned_date.message}</p>
            )}
          </div>

          {/* Target type */}
          <div className="px-5 py-4 flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700 w-28 flex-shrink-0">
              Assign To
            </label>
            <Controller
              name="target_type"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  {['individual', 'team'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        field.onChange(t)
                        setValue('user_id', '')
                        setValue('team_id', '')
                      }}
                      className={cn(
                        'px-4 py-1.5 rounded-md text-sm font-medium border transition-colors',
                        field.value === t
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                      )}
                    >
                      {t === 'individual' ? 'Individual' : 'Entire Team'}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Employee or Team selector */}
          <div className="px-5 py-4 flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700 w-28 flex-shrink-0">
              {targetType === 'individual' ? 'Employee' : 'Team'}
            </label>
            {targetType === 'individual' ? (
              <div className="flex-1">
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...register('user_id')}
                >
                  <option value="">Select employee...</option>
                  {employees
                    .filter((e) => e.role === 'employee')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                        {e.teams?.team_name ? ` — ${e.teams.team_name}` : ''}
                      </option>
                    ))}
                </select>
                {errors.user_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.user_id.message}</p>
                )}
              </div>
            ) : (
              <div className="flex-1">
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  {...register('team_id')}
                >
                  <option value="">Select team...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.team_name}
                    </option>
                  ))}
                </select>
                {errors.team_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.team_id.message}</p>
                )}
              </div>
            )}
          </div>

          {/* KRA Builder */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700">
                KRAs <span className="text-slate-400 font-normal">({fields.length})</span>
              </label>
              <button
                type="button"
                onClick={copyFromYesterday}
                disabled={!canCopy || copyLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copyLoading ? 'Copying...' : 'Copy from yesterday'}
              </button>
            </div>

            {errors.kras?.root && (
              <p className="mb-3 text-xs text-red-600">{errors.kras.root.message}</p>
            )}
            {typeof errors.kras?.message === 'string' && (
              <p className="mb-3 text-xs text-red-600">{errors.kras.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <KraRow
                  key={field.id}
                  idx={idx}
                  register={register}
                  control={control}
                  watch={watch}
                  errors={errors}
                  onRemove={() => remove(idx)}
                  canRemove={fields.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => append(defaultKra())}
              className="mt-3 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-dashed border-slate-300 rounded-md hover:border-indigo-400 hover:text-indigo-600 w-full justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add KRA
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Assigning...' : `Assign ${fields.length} KRA${fields.length !== 1 ? 's' : ''}`}
          </button>
          <p className="text-xs text-slate-400">
            {targetType === 'team' ? 'Will be assigned to all active team members.' : ''}
          </p>
        </div>
      </form>
    </div>
  )
}

function KraRow({ idx, register, control, watch, errors, onRemove, canRemove }) {
  const kraType = watch(`kras.${idx}.kra_type`)

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-slate-400 mt-2.5 w-5 text-center flex-shrink-0">
          {idx + 1}
        </span>
        <div className="flex-1 space-y-3">
          {/* Title */}
          <div>
            <input
              type="text"
              placeholder="KRA title..."
              className={cn(
                'w-full px-3 py-2 border rounded-md text-sm bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500',
                errors.kras?.[idx]?.title ? 'border-red-400' : 'border-slate-300'
              )}
              {...register(`kras.${idx}.title`)}
            />
            {errors.kras?.[idx]?.title && (
              <p className="mt-1 text-xs text-red-600">{errors.kras[idx].title.message}</p>
            )}
          </div>

          {/* Type + Target */}
          <div className="flex items-center gap-3">
            <Controller
              name={`kras.${idx}.kra_type`}
              control={control}
              render={({ field }) => (
                <div className="flex gap-1.5">
                  {['qualitative', 'quantitative'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => field.onChange(t)}
                      className={cn(
                        'px-3 py-1 rounded text-xs font-medium border transition-colors',
                        field.value === t
                          ? t === 'quantitative'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                      )}
                    >
                      {t === 'quantitative' ? 'Quantitative' : 'Qualitative'}
                    </button>
                  ))}
                </div>
              )}
            />

            {kraType === 'quantitative' && (
              <input
                type="number"
                placeholder="Target value"
                min="0"
                step="any"
                className="w-32 px-3 py-1 border border-slate-300 rounded-md text-sm bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                {...register(`kras.${idx}.target_value`)}
              />
            )}
          </div>

          {/* Description */}
          <input
            type="text"
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            {...register(`kras.${idx}.description`)}
          />

          {/* Recurring */}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              {...register(`kras.${idx}.is_recurring`)}
            />
            <span className="text-xs text-slate-500">Mark as recurring</span>
          </label>
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors flex-shrink-0 mt-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
