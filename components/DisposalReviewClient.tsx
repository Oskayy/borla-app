'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ReviewGroup {
  key: string
  driverName: string
  driverPhone: string
  siteName: string | null
  why: string
  photoUrl: string | null
  submittedAt: string
  orders: { id: string; address: string; litres: number | null }[]
}

export default function DisposalReviewClient({ groups }: { groups: ReviewGroup[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function decide(g: ReviewGroup, decision: 'approve' | 'reject') {
    setBusy(g.key)
    try {
      const res = await fetch('/api/admin/disposal-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: g.orders.map((o) => o.id), decision, note: notes[g.key] ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      setMessages((m) => ({
        ...m,
        [g.key]: res.ok
          ? { ok: true, text: decision === 'approve' ? `Approved. GHS ${Number(data.paid ?? 0).toFixed(2)} released.` : 'Sent back to the driver.' }
          : { ok: false, text: data.error || 'Could not save' },
      }))
      if (res.ok) router.refresh()
    } catch {
      setMessages((m) => ({ ...m, [g.key]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  if (groups.length === 0) {
    return (
      <div className="panel">
        <p>Nothing to check. Every unload so far was confirmed at the site.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((g) => (
        <div key={g.key} className="panel" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 200, flexShrink: 0 }}>
            {g.photoUrl ? (
              <a href={g.photoUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.photoUrl} alt="Unload photo" style={{ width: '100%', borderRadius: 4, border: '1px solid var(--color-border)' }} />
              </a>
            ) : (
              <div style={{ height: 140, background: '#F7F5F1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: '#999' }}>No photo</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontWeight: 600 }}>
              {g.driverName} <span style={{ fontWeight: 400, fontSize: 12, color: '#666' }}>{g.driverPhone}</span>
            </p>
            <p style={{ fontSize: 13, color: '#666' }}>
              Planned site: {g.siteName ?? 'none'} · submitted {new Date(g.submittedAt).toLocaleString()}
            </p>
            <p style={{ fontSize: 13, color: '#B3261E', margin: '4px 0 8px' }}>⚠ {g.why}</p>
            <ul style={{ fontSize: 13, margin: '0 0 8px 18px' }}>
              {g.orders.map((o) => (
                <li key={o.id}>
                  {o.address}
                  {o.litres != null && <span style={{ color: '#999' }}> · {o.litres} L</span>}
                </li>
              ))}
            </ul>
            <input
              value={notes[g.key] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [g.key]: e.target.value }))}
              className="input-field"
              placeholder="Note (required to reject), e.g. Photo shows a roadside, not the site"
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => decide(g, 'approve')} disabled={busy === g.key} className="btn-accent">
                Approve and pay
              </button>
              <button
                onClick={() => decide(g, 'reject')}
                disabled={busy === g.key}
                style={{ background: 'none', border: '1px solid #B3261E', color: '#B3261E', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
              >
                Reject
              </button>
            </div>
            {messages[g.key] && (
              <p style={{ fontSize: 13, marginTop: 6, color: messages[g.key].ok ? '#2F7A4D' : '#B3261E' }}>{messages[g.key].text}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
