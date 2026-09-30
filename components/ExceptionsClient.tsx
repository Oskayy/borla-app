'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ExceptionItem {
  kind: 'flagged' | 'payment' | 'gps'
  orderId: string
  status: string
  address: string
  price: number | null
  customerName: string
  customerPhone: string
  driverName: string | null
  reason: string
  updatedAt: string
  payments: { id: string; amount: number; status: string; refundable: number }[]
}

export interface RefundRow {
  id: string
  orderId: string
  address: string
  customerName: string
  amount: number
  status: string
  reason: string
  createdAt: string
}

const SECTION_TITLES: Record<ExceptionItem['kind'], string> = {
  flagged: 'Failed pickups and disputes',
  payment: 'Payment problems',
  gps: 'GPS mismatches (collected and paid, worth a check)',
}

const STATUS_COLORS: Record<string, string> = {
  PROCESSED: '#2F7A4D',
  PENDING: '#9A6415',
  PROCESSING: '#9A6415',
  NEEDS_ATTENTION: '#B3261E',
  FAILED: '#B3261E',
}

function SettleRefund({ id }: { id: string }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  async function settle(outcome: 'processed' | 'failed') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not save')
      else router.refresh()
    } catch {
      setError('Could not reach Borla. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const btn = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: 'pointer' } as const
  return (
    <div style={{ marginTop: 8, width: '100%' }}>
      <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="What Paystack shows (required)" style={{ marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={btn} disabled={busy || note.trim().length < 3} onClick={() => settle('processed')}>Paystack shows it was refunded</button>
        <button style={btn} disabled={busy || note.trim().length < 3} onClick={() => settle('failed')}>No refund in Paystack: release it</button>
      </div>
      {error && <p style={{ color: '#B3261E', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  )
}

export default function ExceptionsClient({ items, refunds, canRefund }: { items: ExceptionItem[]; refunds: RefundRow[]; canRefund: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const [mode, setMode] = useState<'retry' | 'close' | 'refund' | 'review'>('retry')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [cancelToo, setCancelToo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  function start(item: ExceptionItem, m: typeof mode) {
    const key = `${item.kind}-${item.orderId}`
    setOpen(key)
    setMode(m)
    setNote('')
    const pay = item.kind === 'payment' ? item.payments[item.payments.length - 1] : item.payments.find((p) => p.refundable > 0)
    setPaymentId(pay?.id ?? '')
    setAmount(pay ? pay.refundable.toFixed(2) : '')
    setCancelToo(item.kind === 'flagged')
  }

  async function submit(item: ExceptionItem) {
    const key = `${item.kind}-${item.orderId}`
    setBusy(true)
    try {
      let res: Response
      if (mode === 'refund') {
        res = await fetch(`/api/admin/orders/${item.orderId}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Number(amount), reason: note, cancel: cancelToo, paymentId: paymentId || undefined }),
        })
      } else {
        const action = mode === 'review' ? (item.kind === 'gps' ? 'gps_reviewed' : 'payment_reviewed') : mode
        res = await fetch(`/api/admin/exceptions/${item.orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, note }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg((m) => ({ ...m, [key]: { ok: false, text: data.error || 'Could not save' } }))
        return
      }
      setMsg((m) => ({
        ...m,
        [key]: {
          ok: true,
          text:
            mode === 'refund'
              ? `Refund of GHS ${Number(data.refunded ?? 0).toFixed(2)} started.`
              : mode === 'retry'
              ? `Back in the queue for the night of ${data.night}.`
              : 'Done.',
        },
      }))
      setOpen(null)
      router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [key]: { ok: false, text: 'Could not reach Borla. Please try again.' } }))
    } finally {
      setBusy(false)
    }
  }

  const btn = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', fontSize: 13, cursor: 'pointer' } as const
  const kinds: ExceptionItem['kind'][] = ['flagged', 'payment', 'gps']

  return (
    <div>
      {kinds.map((kind) => {
        const list = items.filter((i) => i.kind === kind)
        return (
          <section key={kind} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>
              {SECTION_TITLES[kind]} <span style={{ fontSize: 13, color: '#999' }}>({list.length})</span>
            </h2>
            {list.length === 0 && (
              <div className="panel">
                <p style={{ fontSize: 14 }}>Nothing here right now.</p>
              </div>
            )}
            {list.map((item) => {
              const key = `${item.kind}-${item.orderId}`
              const canRefundThis = canRefund && item.payments.some((p) => p.refundable > 0)
              return (
                <div key={key} className="panel" style={{ marginBottom: 10, borderLeft: `4px solid ${kind === 'gps' ? '#E8A33D' : '#B3261E'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <p style={{ fontWeight: 600 }}>{item.address}</p>
                      <p style={{ fontSize: 13, color: '#666' }}>
                        {item.customerName}
                        {item.customerPhone && (
                          <>
                            {' · '}
                            <a href={`tel:${item.customerPhone}`}>{item.customerPhone}</a>
                          </>
                        )}
                        {item.price != null && ` · GHS ${item.price}`}
                        {item.driverName && ` · driver ${item.driverName}`}
                      </p>
                      <p style={{ fontSize: 13, margin: '4px 0' }}>
                        <strong>{item.status}</strong> · {item.reason}
                      </p>
                      {item.payments.length > 0 && (
                        <p style={{ fontSize: 12, color: '#666' }}>
                          Payments:{' '}
                          {item.payments.map((p) => `GHS ${p.amount.toFixed(2)} (${p.status}, GHS ${p.refundable.toFixed(2)} refundable)`).join('; ')}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {kind === 'flagged' && (
                        <>
                          <button style={btn} onClick={() => start(item, 'retry')}>Try again</button>
                          <button style={btn} onClick={() => start(item, 'close')}>Close, no refund</button>
                        </>
                      )}
                      {kind !== 'flagged' && (
                        <button style={btn} onClick={() => start(item, 'review')}>Mark checked</button>
                      )}
                      {canRefundThis && (
                        <button style={{ ...btn, borderColor: '#B3261E', color: '#B3261E' }} onClick={() => start(item, 'refund')}>
                          Refund
                        </button>
                      )}
                    </div>
                  </div>

                  {open === key && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                      <p style={{ fontSize: 13, marginBottom: 6 }}>
                        {mode === 'retry' && 'The order goes back into tonight’s queue (or the coming night) and is assigned to a driver as usual. The customer is told.'}
                        {mode === 'close' && 'The order is cancelled with no refund. The customer is told, with your note.'}
                        {mode === 'review' && 'Takes this off the list. Nothing else changes.'}
                        {mode === 'refund' && 'Sends money back to the account the customer paid with, through Paystack.'}
                      </p>
                      {mode === 'refund' && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          {item.payments.length > 1 && (
                            <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className="input-field" style={{ marginBottom: 0, width: 'auto' }}>
                              {item.payments.map((p) => (
                                <option key={p.id} value={p.id}>
                                  GHS {p.amount.toFixed(2)} ({p.status})
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="input-field"
                            style={{ marginBottom: 0, width: 140 }}
                            placeholder="Amount (GHS)"
                          />
                          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={cancelToo} onChange={(e) => setCancelToo(e.target.checked)} />
                            Also cancel the order
                          </label>
                        </div>
                      )}
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="input-field"
                        placeholder="Note (required), e.g. Called customer, gate will be open tomorrow"
                        style={{ marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => submit(item)} disabled={busy || note.trim().length < 3} className="btn-primary">
                          {busy ? 'Saving...' : 'Confirm'}
                        </button>
                        <button onClick={() => setOpen(null)} disabled={busy} style={btn}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {msg[key] && <p style={{ fontSize: 13, marginTop: 6, color: msg[key].ok ? '#2F7A4D' : '#B3261E' }}>{msg[key].text}</p>}
                </div>
              )
            })}
          </section>
        )
      })}

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Refunds (open, and the last 14 days)</h2>
        {refunds.length === 0 && (
          <div className="panel">
            <p style={{ fontSize: 14 }}>No refunds.</p>
          </div>
        )}
        {refunds.map((r) => (
          <div key={r.id} className="panel" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                GHS {r.amount.toFixed(2)} · {r.customerName}
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>
                {r.address} · {new Date(r.createdAt).toLocaleString()} · {r.reason}
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[r.status] ?? '#666' }}>
              {r.status === 'NEEDS_ATTENTION' ? 'NEEDS ATTENTION: check the Paystack dashboard' : r.status}
            </span>
            {canRefund && r.status === 'NEEDS_ATTENTION' && <SettleRefund id={r.id} />}
          </div>
        ))}
      </section>
    </div>
  )
}
