'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>To {walletLabel}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input-field"
          style={{ marginBottom: 0, flex: 1 }}
        />
        <button onClick={request} disabled={busy} className="btn-accent" style={{ whiteSpace: 'nowrap' }}>
          {busy ? 'Requesting...' : 'Withdraw'}
        </button>
      </div>
      {msg && <p style={{ fontSize: 13, marginTop: 6, color: msg.ok ? '#2F7A4D' : '#B3261E' }}>{msg.text}</p>}
    </div>
  )
}
