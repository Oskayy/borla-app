'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

// Deletes an unpaid booking (it was never scheduled, so nothing else changes).
export default function DeleteDraftButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this unpaid booking? This cannot be undone.')) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/orders/delete-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not delete it')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        onClick={handleDelete}
        disabled={loading}
        aria-label="Delete this unpaid booking"
        className="grid size-11 place-items-center rounded-full text-ink-3 transition hover:bg-danger-wash hover:text-danger disabled:opacity-50"
      >
        <Trash2 aria-hidden className="size-[18px]" />
      </button>
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
