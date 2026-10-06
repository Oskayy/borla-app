'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LocateFixed, Power } from 'lucide-react'

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
    <section className={`h-full rounded-card p-4 ring-1 sm:p-5 ${online ? 'bg-action-wash ring-action/40' : 'bg-surface ring-line'}`}>
      <div className="flex items-center gap-4">
        <span className={`relative grid size-12 shrink-0 place-items-center rounded-full ${online ? 'bg-action text-on-action' : 'bg-canvas text-ink-3 ring-1 ring-line'}`}>
          <Power aria-hidden className="size-5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tracking-tight">{online ? 'You are online' : 'You are offline'}</p>
          <p className="text-sm text-ink-3">
            Shift {shiftLabel}
            {overrideUntil && ` · extra hours until ${new Date(overrideUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={online}
          aria-label={online ? 'Go offline' : 'Go online'}
          onClick={toggle}
          disabled={disabled}
          className={`min-h-12 shrink-0 rounded-full px-5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            online ? 'bg-canvas text-ink ring-1 ring-line-strong' : 'bg-action text-on-action shadow-card hover:brightness-95'
          }`}
        >
          {busy ? '…' : online ? 'Go offline' : 'Go online'}
        </button>
      </div>

      {!online && !canGoOnline && <p className="mt-3 text-sm text-ink-3">You can go online when the shift starts.</p>}
      {online && gps === 'on' && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
          <LocateFixed aria-hidden className="size-4 text-action" /> Sharing your location while you are online
        </p>
      )}
      {online && gps === 'idle' && <p className="mt-3 text-sm text-ink-3">Getting your location…</p>}
      {online && gps === 'denied' && (
        <p role="alert" className="mt-3 text-sm text-danger">
          Location is blocked. Turn it on in your browser settings so we can send you nearby pickups.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  )
}
