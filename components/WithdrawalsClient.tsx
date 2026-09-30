'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface WithdrawalRow {
  id: string
  driverName: string
  driverPhone: string
  amount: number
  status: string
  momo: string
  note: string | null
  method: string | null
  requestedAt: string
  paidAt: string | null
  totalEarned: number | null
}

const COLORS: Record<string, string> = { PAID: '#2F7A4D', FAILED: '#B3261E', REJECTED: '#B3261E', PROCESSING: '#9A6415', REQUESTED: '#9A6415' }

export default function WithdrawalsClient({ open, recent }: { open: WithdrawalRow[]; recent: WithdrawalRow[] }) {
  const [active, setActive] = useState<{ id: string; action: 'mark_paid' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function act(id: string, action: 'send' | 'mark_paid' | 'reject' | 'check') {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: action === 'send' || action === 'check' ? undefined : note }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg((m) => ({
        ...m,
        [id]: res.ok
          ? {
              ok: true,
              text:
                data.status === 'PAID'
                  ? 'Paid.'
                  : data.status === 'FAILED'
                  ? 'The transfer failed; the money is back in the driver’s balance.'
                  : data.status === 'REQUESTED'
                  ? 'Paystack never received it. Safe to send again.'
                  : data.paystackStatus === 'otp'
                  ? 'Waiting for OTP in Paystack.'
                  : data.paystackStatus === 'unknown'
                  ? 'No answer from Paystack yet. Press Check in a few minutes.'
                  : 'Sent to Paystack. It will show as Paid when confirmed.',
            }
          : { ok: false, text: data.error || 'Could not save' },
      }))
      if (res.ok) {
        setActive(null)
        setNote('')
        router.refresh()
      }
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: 'Could not reach Borla. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  const btn = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', fontSize: 13, cursor: 'pointer' } as const

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Waiting ({open.length})</h2>
      {open.length === 0 && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14 }}>No withdrawals waiting.</p>
        </div>
      )}
      {open.map((w) => (
        <div key={w.id} className="panel" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontWeight: 600 }}>
                GHS {w.amount.toFixed(2)} · {w.driverName}{' '}
                <a href={`tel:${w.driverPhone}`} style={{ fontWeight: 400, fontSize: 13 }}>
                  {w.driverPhone}
                </a>
              </p>
              <p style={{ fontSize: 13, color: '#666' }}>
                To {w.momo} · asked {new Date(w.requestedAt).toLocaleString()}
                {w.totalEarned != null && ` · earned GHS ${w.totalEarned.toFixed(2)} in total`}
              </p>
              {w.note && <p style={{ fontSize: 12, color: '#B3261E', marginTop: 4 }}>{w.note}</p>}
            </div>
            {w.status === 'REQUESTED' ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <button onClick={() => act(w.id, 'send')} disabled={busy === w.id} className="btn-accent">
                  {busy === w.id ? '...' : 'Send via Paystack'}
                </button>
                <button style={btn} onClick={() => { setActive({ id: w.id, action: 'mark_paid' }); setNote('') }}>
                  Mark paid
                </button>
                <button style={{ ...btn, color: '#B3261E', borderColor: '#B3261E' }} onClick={() => { setActive({ id: w.id, action: 'reject' }); setNote('') }}>
                  Reject
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS[w.status] }}>BEING SENT</span>
                {w.method === 'paystack' && (
                  <button style={btn} disabled={busy === w.id} onClick={() => act(w.id, 'check')}>
                    {busy === w.id ? '...' : 'Check'}
                  </button>
                )}
              </div>
            )}
          </div>
          {active?.id === w.id && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field"
                style={{ marginBottom: 0, flex: 1, minWidth: 220 }}
                placeholder={active.action === 'mark_paid' ? 'MoMo transaction ID of your payment' : 'Reason (the driver sees this)'}
              />
              <button onClick={() => act(w.id, active.action)} disabled={busy === w.id || note.trim().length < 3} className="btn-primary">
                {active.action === 'mark_paid' ? 'Confirm paid' : 'Confirm reject'}
              </button>
              <button style={btn} onClick={() => setActive(null)}>
                Cancel
              </button>
            </div>
          )}
          {msg[w.id] && <p style={{ fontSize: 13, marginTop: 6, color: msg[w.id].ok ? '#2F7A4D' : '#B3261E' }}>{msg[w.id].text}</p>}
        </div>
      ))}

      <h2 style={{ fontSize: 18, margin: '24px 0 10px' }}>Recent</h2>
      {recent.map((w) => (
        <div key={w.id} className="panel" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              GHS {w.amount.toFixed(2)} · {w.driverName}
            </p>
            <p style={{ fontSize: 12, color: '#666' }}>
              {w.momo} · {new Date(w.requestedAt).toLocaleDateString()}
              {w.method && ` · ${w.method === 'manual' ? 'paid by hand' : 'Paystack'}`}
              {w.note && ` · ${w.note}`}
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS[w.status] ?? '#666' }}>{w.status}</span>
        </div>
      ))}
    </div>
  )
}
