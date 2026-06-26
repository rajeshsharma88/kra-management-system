import Link from 'next/link'
import { Clock } from 'lucide-react'

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-amber-50 rounded-full p-3">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Session expired</h1>
        <p className="text-sm text-slate-500 mb-6">
          You were signed out due to inactivity. Please log in again to continue.
        </p>
        <Link
          href="/login"
          className="block w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}
