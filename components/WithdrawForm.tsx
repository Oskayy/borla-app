'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'

export default function WithdrawForm({ available, walletLabel }: { available: number; walletLabel: string }) {
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
      setMsg({ ok: true, text: 'Requested. You’ll get a message when the money is sent.' })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-3">To {walletLabel}</p>
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
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${FIELD} pl-14 text-lg font-semibold tabular-nums`}
          />
        </div>
        <button onClick={request} disabled={busy} className={`min-h-12 ${BUTTON_PRIMARY}`}>
          {busy ? 'Requesting…' : 'Withdraw'}
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
