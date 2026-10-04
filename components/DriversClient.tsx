'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DriverRow {
  id: string
  name: string
  phone: string
  active: boolean
  online: boolean
  onlineSince: string | null
  overrideUntil: string | null
  vehicle: string | null
  capacityLitres: number | null
  radiusKm: number | null
  zone: string | null
  hasHomeBase: boolean
  lastLocationAt: string | null
}

function minutesAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)} h ${mins % 60} min ago`
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function DriversClient({ drivers }: { drivers: DriverRow[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [hours, setHours] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function setOverride(driverId: string, h: number) {
    setBusy(driverId)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}/online-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: h }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error || 'Could not update the driver')
        return
      }
      router.refresh()
    } catch {
      setMessage('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const smallButton = {
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
  } as const

  return (
    <div>
      {message && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{message}</p>}
      {drivers.length === 0 && (
        <div className="panel">
          <p>No drivers yet.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drivers.map((d) => (
          <div key={d.id} className="panel" style={{ opacity: d.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      display: 'inline-block',
                      background: d.online ? 'var(--color-success)' : '#bbb',
                    }}
                  />
                  {d.name}
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#666' }}>{d.phone}</span>
                  {!d.active && <span style={{ fontSize: 11, color: '#B3261E' }}>PAUSED</span>}
                </p>
                <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {d.vehicle ?? 'No vehicle set'}
                  {d.capacityLitres != null && ` (${d.capacityLitres.toLocaleString()} L)`}
                  {d.radiusKm != null && ` · ${d.radiusKm} km radius`}
                  {d.zone && ` · ${d.zone}`}
                  {!d.hasHomeBase && ' · no home base yet'}
                </p>
                <p style={{ fontSize: 12, marginTop: 2, color: d.online ? '#2F7A4D' : '#999' }}>
                  {d.online
                    ? `Online${d.onlineSince ? ` since ${clock(d.onlineSince)}` : ''}${
                        d.lastLocationAt ? ` · location ${minutesAgo(d.lastLocationAt)}` : ' · waiting for location'
                      }`
                    : 'Offline'}
                </p>
                {d.overrideUntil && (
                  <p style={{ fontSize: 12, marginTop: 2, color: '#9A6415' }}>Extra hours allowed until {clock(d.overrideUntil)}</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {d.overrideUntil ? (
                  <button onClick={() => setOverride(d.id, 0)} disabled={busy === d.id} style={smallButton}>
                    Remove extra hours
                  </button>
                ) : (
                  <>
                    <select
                      value={hours[d.id] ?? '2'}
                      onChange={(e) => setHours((h) => ({ ...h, [d.id]: e.target.value }))}
                      style={{ fontSize: 12, padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 4 }}
                      aria-label={`Extra hours for ${d.name}`}
                    >
                      {[1, 2, 4, 8, 12].map((h) => (
                        <option key={h} value={h}>
                          {h} h
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setOverride(d.id, Number(hours[d.id] ?? '2'))}
                      disabled={busy === d.id || !d.active}
                      style={smallButton}
                    >
                      Allow extra hours
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
