'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'

// "Cash out now": the rest is paid automatically every morning. The first cash-out each day is free; later ones
// pay the GHS 1 transfer fee out of the amount.
export default function WithdrawForm({ available, walletLabel, freeToday }: { available: number; walletLabel: string; freeToday: boolean }) {
  const [amount, setAmount] = useState(available.toFixed(2))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  async function request() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/driver/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not request the withdrawal' })
        return
      }
      setMsg({
        ok: true,
        text:
          data.status === 'PAID' || data.status === 'PROCESSING'
            ? 'Sent. It usually reaches your wallet within a few minutes.'
            : 'Requested. Trashit sends it soon, and you’ll get a message when it’s on its way.',
      })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-3">
        To {walletLabel}. {freeToday ? 'Your first cash-out today is free.' : 'You’ve cashed out today, so this one costs GHS 1 (taken from the amount).'}
      </p>
      <div className="flex gap-2">
        <label htmlFor="withdraw-amount" className="sr-only">
          Amount in GHS
        </label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-ink-3">GHS</span>
          <input
            id="withdraw-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${FIELD} pl-14 text-lg font-semibold tabular-nums`}
          />
        </div>
        <button onClick={request} disabled={busy} className={`min-h-12 ${BUTTON_PRIMARY}`}>
          {busy ? 'Sending…' : 'Cash out now'}
        </button>
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-customer-deep' : 'text-danger'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
