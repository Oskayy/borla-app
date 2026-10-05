'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface VehicleChangeRow {
  id: string // driver id
  name: string
  phone: string
  plate: string | null
  from: { name: string; capacityLitres: number } | null
  to: { name: string; capacityLitres: number } | null
  sentAt: string
  oldPhoto: string | null // signed URLs
  newPhoto: string | null
}

// Driver Approvals: approved drivers asking to switch vehicle type. Approving changes the capacity dispatch plans with.
export default function VehicleChangeReviews({ rows }: { rows: VehicleChangeRow[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/drivers/${id}/vehicle-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[id] ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg((m) => ({
        ...m,
        [id]: res.ok ? { ok: true, text: decision === 'approve' ? 'Approved.' : 'Sent back to the driver.' } : { ok: false, text: data.error || 'Could not save' },
      }))
      if (res.ok) router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  const photo = (url: string | null, label: string) => (
    <div style={{ width: 180 }}>
      <p style={{ fontSize: 11, color: '#5f6b7a', marginBottom: 2 }}>{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} style={{ width: 180, height: 130, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
        </a>
      ) : (
        <div style={{ width: 180, height: 130, background: '#F7F5F1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#5f6b7a' }}>
          No photo
        </div>
      )}
    </div>
  )

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, marginBottom: 6 }}>Vehicle changes to approve ({rows.length})</h2>
      <p style={{ fontSize: 13, color: '#5f6b7a', marginBottom: 10 }}>
        These drivers are approved and keep working on their current vehicle until you decide. Check the photo shows the new vehicle type.
      </p>
      {rows.length === 0 && (
        <div className="panel">
          <p style={{ fontSize: 14 }}>No vehicle changes waiting.</p>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className="panel" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600 }}>
            {r.name}{' '}
            <span style={{ fontWeight: 400, fontSize: 13 }}>
              <a href={`tel:${r.phone}`}>{r.phone}</a>
              {r.plate && ` · plate ${r.plate}`}
            </span>
          </p>
          <p style={{ fontSize: 13, margin: '4px 0 8px' }}>
            {r.from ? `${r.from.name} (${r.from.capacityLitres.toLocaleString()} L)` : 'No vehicle'} →{' '}
            <strong>{r.to ? `${r.to.name} (${r.to.capacityLitres.toLocaleString()} L)` : 'Unknown vehicle'}</strong>
            <span style={{ color: '#5f6b7a' }}> · sent {new Date(r.sentAt).toLocaleString()}</span>
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            {photo(r.oldPhoto, 'Current vehicle')}
            {photo(r.newPhoto, 'New vehicle')}
          </div>
          <input
            value={notes[r.id] ?? ''}
            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            className="input-field"
            placeholder="Note to the driver (required to send back), e.g. Photo doesn't show the whole vehicle"
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => decide(r.id, 'approve')} disabled={busy === r.id} className="btn-accent">
              Approve change
            </button>
            <button
              onClick={() => decide(r.id, 'reject')}
              disabled={busy === r.id}
              style={{ background: 'none', border: '1px solid #B3261E', color: '#B3261E', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
            >
              Send back
            </button>
          </div>
          {msg[r.id] && <p style={{ fontSize: 13, marginTop: 6, color: msg[r.id].ok ? '#2F7A4D' : '#B3261E' }}>{msg[r.id].text}</p>}
        </div>
      ))}
    </div>
  )
}
