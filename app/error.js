'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-red-50 rounded-full p-3">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-500 mb-6">
          An unexpected error occurred. Please try again, or contact your admin if the problem persists.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Go to home
          </Link>
        </div>
      </div>
    </div>
  )
}
