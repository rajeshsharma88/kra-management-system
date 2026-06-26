'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { loginSchema } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  })

  const username = watch('username')
  const password = watch('password')

  async function onSubmit(data) {
    setLoading(true)
    setServerError('')
    const supabase = createClient()

    const email = `${data.username}@kra.internal`
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: data.password,
    })

    if (signInError) {
      setServerError(`Auth error: ${signInError.message} (status: ${signInError.status})`)
      setLoading(false)
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, is_active')
      .eq('username', data.username)
      .single()

    if (userError || !userData) {
      await supabase.auth.signOut()
      setServerError(`Profile error: ${userError?.message ?? 'no user row found'} (username: ${data.username})`)
      setLoading(false)
      return
    }

    if (!userData.is_active) {
      await supabase.auth.signOut()
      setServerError('Your account has been deactivated. Contact your admin.')
      setLoading(false)
      return
    }

    if (userData.role === 'admin' || userData.role === 'owner') {
      router.push('/dashboard')
    } else {
      router.push('/today')
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">KRA Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="e.g. rahul_sharma"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150"
                {...register('username')}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-red-600">{serverError}</p>
            )}

            <button
              type="submit"
              disabled={!username || !password || loading}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          Forgot your password? Contact your admin.
        </p>
      </div>
    </div>
  )
}
