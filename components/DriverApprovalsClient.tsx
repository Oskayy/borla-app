'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ApplicantRow {
  id: string
  name: string
  phone: string
  email: string | null
  signedUpAt: string
  status: string
  note: string | null
  submittedAt: string | null
  vehicle: string | null
  docs: { type: string; label: string; url: string | null }[]
}

export default function DriverApprovalsClient({ waiting, notSent, rejected }: { waiting: ApplicantRow[]; notSent: ApplicantRow[]; rejected: ApplicantRow[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/drivers/${id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[id] ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg((m) => ({ ...m, [id]: res.ok ? { ok: true, text: decision === 'approve' ? 'Approved.' : 'Sent back to the driver.' } : { ok: false, text: data.error || 'Could not save' } }))
      if (res.ok) router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: 'Could not reach Borla. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  function card(r: ApplicantRow, actions: boolean) {
    return (
      <div key={r.id} className="panel" style={{ marginBottom: 12 }}>
        <p style={{ fontWeight: 600 }}>
          {r.name} <span style={{ fontWeight: 400, fontSize: 13 }}><a href={`tel:${r.phone}`}>{r.phone}</a>{r.email && ` · ${r.email}`}</span>
        </p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          {r.vehicle ?? 'No vehicle chosen'} · signed up {new Date(r.signedUpAt).toLocaleDateString()}
          {r.submittedAt && ` · sent ${new Date(r.submittedAt).toLocaleString()}`}
          {r.note && ` · last note: ${r.note}`}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {r.docs.map((d) => (
            <div key={d.type} style={{ width: 150 }}>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{d.label}</p>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.url} alt={d.label} style={{ width: 150, height: 110, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
                </a>
              ) : (
                <div style={{ width: 150, height: 110, background: '#F7F5F1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>
                  Not uploaded
                </div>
              )}
            </div>
          ))}
        </div>
        {actions && (
          <>
            <input
              value={notes[r.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              className="input-field"
              placeholder="Note to the driver (required to send back), e.g. Ghana Card photo is blurry"
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => decide(r.id, 'approve')} disabled={busy === r.id} className="btn-accent">Approve</button>
              <button
                onClick={() => decide(r.id, 'reject')}
                disabled={busy === r.id}
                style={{ background: 'none', border: '1px solid #B3261E', color: '#B3261E', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
              >
                Send back
              </button>
            </div>
          </>
        )}
        {msg[r.id] && <p style={{ fontSize: 13, marginTop: 6, color: msg[r.id].ok ? '#2F7A4D' : '#B3261E' }}>{msg[r.id].text}</p>}
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Waiting for review ({waiting.length})</h2>
      {waiting.length === 0 && <div className="panel" style={{ marginBottom: 20 }}><p style={{ fontSize: 14 }}>No drivers waiting.</p></div>}
      {waiting.map((r) => card(r, true))}

      <h2 style={{ fontSize: 18, margin: '24px 0 10px' }}>Sent back, waiting for the driver ({rejected.length})</h2>
      {rejected.map((r) => card(r, true))}

      <h2 style={{ fontSize: 18, margin: '24px 0 10px' }}>Signed up, documents not sent yet ({notSent.length})</h2>
      {notSent.map((r) => card(r, false))}
    </div>
  )
}
