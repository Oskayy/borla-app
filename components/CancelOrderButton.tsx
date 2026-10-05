'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

// Cancels a paid order before its collection night and refunds it in full.
export default function CancelOrderButton({ orderId, amount }: { orderId: string; amount: number }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function cancel() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not cancel')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center rounded-control px-4 text-[15px] font-semibold text-danger ring-1 ring-danger/40 transition hover:bg-danger-wash"
      >
        Cancel this pickup
      </button>
    )
  }

  return (
    <div className="rounded-card bg-danger-wash p-4">
      <p className="text-[15px] text-ink">
        Cancel this pickup? You&apos;ll get a full refund of <strong className="tabular-nums">GHS {amount.toFixed(2)}</strong> to
        the account you paid with. It usually arrives within a few working days.
      </p>
      <label htmlFor="cancel-reason" className="mt-3 block text-sm font-medium text-ink-2">
        Reason (optional)
      </label>
      <input
        id="cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1.5 block w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] focus:border-danger focus:outline-none"
      />
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden className="size-4" /> {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={cancel}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-control bg-danger px-4 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Cancelling…' : 'Yes, cancel and refund'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 text-[15px] font-semibold text-ink ring-1 ring-line-strong"
        >
          Keep my pickup
        </button>
      </div>
    </div>
  )
}
