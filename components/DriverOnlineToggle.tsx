'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const SEND_EVERY_MS = 30_000 // send the position at most every 30 seconds

// "Go online / Go offline" for drivers. The phone's location is only shared while online.
export default function DriverOnlineToggle({
  initialOnline,
  canGoOnline,
  shiftLabel,
  overrideUntil,
}: {
  initialOnline: boolean
  canGoOnline: boolean // true during shift hours, or when ops have given an override
  shiftLabel: string // e.g. "8:00pm – 6:00am"
  overrideUntil: string | null
}) {
  const [online, setOnline] = useState(initialOnline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [gps, setGps] = useState<'idle' | 'on' | 'denied'>('idle')
  const lastSent = useRef(0)
  const router = useRouter()

  // Share location only while online.
  useEffect(() => {
    if (!online || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGps('on')
        const now = Date.now()
        if (now - lastSent.current < SEND_EVERY_MS) return
        lastSent.current = now
        fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        })
          .then((res) => {
            // 409 = the shift has ended, so the server switched this driver offline.
            if (res.status === 409) {
              setOnline(false)
              setError(`The shift has ended, so you've been switched offline. See you at ${shiftLabel.split(' – ')[0]}.`)
              router.refresh()
            }
          })
          .catch(() => {
            // A missed update isn't worth interrupting the driver over.
          })
      },
      () => setGps('denied'),
      { enableHighAccuracy: true, maximumAge: 15_000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      setGps('idle')
    }
  }, [online, shiftLabel, router])

  async function toggle() {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/driver/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: !online }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not change your status')
        return
      }
      lastSent.current = 0 // send the first position straight away
      setOnline(data.online)
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || (!online && !canGoOnline)

  return (
    <div
      className="panel"
      style={{
        marginBottom: 16,
        borderLeft: `4px solid ${online ? 'var(--color-success)' : '#999'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <p style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: online ? 'var(--color-success)' : '#999',
                display: 'inline-block',
              }}
            />
            {online ? 'You are online' : 'You are offline'}
          </p>
          <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            Shift hours: {shiftLabel}
            {overrideUntil && ` · Extra hours allowed until ${new Date(overrideUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={disabled}
          className={online ? undefined : 'btn-accent'}
          style={
            online
              ? { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '8px 14px', fontSize: 14 }
              : { padding: '8px 14px', opacity: disabled ? 0.5 : 1 }
          }
        >
          {busy ? '...' : online ? 'Go offline' : 'Go online'}
        </button>
      </div>

      {!online && !canGoOnline && (
        <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
          You can go online when the shift starts. Collections only happen during shift hours.
        </p>
      )}
      {online && gps === 'on' && <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>📍 Sharing your location while you are online</p>}
      {online && gps === 'idle' && <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Getting your location...</p>}
      {online && gps === 'denied' && (
        <p style={{ fontSize: 12, color: '#B3261E', marginTop: 8 }}>
          Location is blocked. Turn it on in your browser settings so we can send you nearby pickups.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: '#B3261E', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
