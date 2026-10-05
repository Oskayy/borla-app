'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { PANEL, Result } from '@/components/ops/kit'

export default function PayoutRuleForm() {
  const [pickupPercent, setPickupPercent] = useState('40')
  const [disposalPercent, setDisposalPercent] = useState('60')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const total = Number(pickupPercent || 0) + Number(disposalPercent || 0)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payout-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupPercent, disposalPercent }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create rule')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="h-new-rule" className={PANEL}>
      <h2 id="h-new-rule" className="text-base font-semibold tracking-tight">
        New payout rule
      </h2>
      <p className="mt-1 text-sm text-ink-3">How the driver pool (the order price after the platform fee) is split between the two moments of a stop.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-ink-2">At pickup (%)</span>
          <input type="number" min={0} max={100} value={pickupPercent} onChange={(e) => setPickupPercent(e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} />
        </label>
        <label>
          <span className="text-sm font-medium text-ink-2">At unload (%)</span>
          <input type="number" min={0} max={100} value={disposalPercent} onChange={(e) => setDisposalPercent(e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} />
        </label>
      </div>
      <p className={`mt-2 text-sm tabular-nums ${total === 100 ? 'text-ink-3' : 'font-medium text-danger'}`}>
        Total {total}%{total === 100 ? '' : ' (must be 100%)'}
      </p>
      <Result msg={error ? { ok: false, text: error } : null} />
      <button type="button" onClick={submit} disabled={loading || total !== 100} className={`${BUTTON_PRIMARY} mt-4 w-full sm:w-auto`}>
        {loading ? 'Saving…' : 'Make this the active rule'}
      </button>
      <p className="mt-2 text-sm text-ink-3">Only affects pickups and unloads from now on, not money already paid.</p>
    </section>
  )
}
