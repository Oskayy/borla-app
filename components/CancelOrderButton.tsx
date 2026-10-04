'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
        style={{ background: 'none', border: '1px solid #B3261E', color: '#B3261E', borderRadius: 4, padding: '8px 14px', fontSize: 14, cursor: 'pointer' }}
      >
        Cancel this pickup
      </button>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 14, marginBottom: 8 }}>
        Cancel this pickup? You&apos;ll get a full refund of <strong>GHS {amount.toFixed(2)}</strong> to the account you paid with.
        It usually arrives within a few working days.
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input-field"
        placeholder="Reason (optional)"
        style={{ marginBottom: 8 }}
      />
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={cancel} disabled={busy} style={{ background: '#B3261E', color: 'white', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}>
          {busy ? 'Cancelling...' : 'Yes, cancel and refund'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
        >
          Keep it
        </button>
      </div>
    </div>
  )
}
