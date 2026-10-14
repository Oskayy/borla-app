'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// "Mark reviewed" on a low rating (Driver ratings page).
export default function ReviewRatingButton({ ratingId }: { ratingId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function review() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/ratings/${ratingId}`, { method: 'POST' }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}))
      setError(data?.error ?? 'Could not save. Please try again.')
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={review}
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-control px-4 text-sm font-semibold text-action-deep ring-1 ring-action-deep/40 hover:bg-action-wash disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Mark reviewed'}
      </button>
      <span aria-live="polite" className="text-sm text-danger">
        {error}
      </span>
    </span>
  )
}
