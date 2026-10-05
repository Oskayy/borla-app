'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'

// Marks the unread messages on screen as read (the endpoint takes up to 50 at a time).
export default function MarkAllRead({ ids }: { ids: string[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  if (ids.length === 0) return null

  async function markAll() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids.slice(0, 50) }),
      })
      if (!res.ok) setError('Could not update. Please try again.')
      else router.refresh()
    } catch {
      setError('Could not reach Trashit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={markAll}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold text-customer-deep hover:bg-customer-wash disabled:opacity-60"
      >
        <CheckCheck aria-hidden className="size-4" /> {busy ? 'Marking…' : 'Mark all as read'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
