import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-slate-100 rounded-full p-3">
            <FileQuestion className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <p className="text-5xl font-bold text-slate-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Go to home
        </Link>
      </div>
    </div>
  )
}
