'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LocateFixed, Power } from 'lucide-react'

const SEND_EVERY_MS = 30_000 // send the position at most every 30 seconds

// "Go online / Go offline" for drivers. The phone's location is only shared while online.
export default function DriverOnlineToggle({
  initialOnline,
  canGoOnline,
  shiftLabel,
  overrideUntil,
  summary,
  children,
}: {
  initialOnline: boolean
  canGoOnline: boolean // true during shift hours, or when ops have given an override
  shiftLabel: string // e.g. "8:00pm – 6:00am"
  overrideUntil: string | null
  summary?: string // the night in a line, e.g. "6 stops in 2 trips · about 1 h 40 min"
  children?: React.ReactNode // pill shortcuts (HeroLink)
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

  // The dark "hero" card at the top of Tonight: status, the switch (top right), the night in numbers, then
  // the shortcuts passed in as children.
  return (
    <section aria-label="Your shift" className="hero-glow rounded-card bg-hero p-5 text-on-hero shadow-lift sm:p-6">
      {/* The button drops under the text on very small phones rather than squeezing it. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[10.5rem]">
          <p className="text-sm text-on-hero-2">
            Shift {shiftLabel}
            {overrideUntil && ` · extra hours until ${new Date(overrideUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </p>
          <p className="mt-1.5 flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.02em]">
            <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${online ? 'animate-pulse bg-[#4ade80] shadow-[0_0_0_4px_rgb(74_222_128/0.2)]' : 'bg-on-hero-2'}`} />
            {online ? 'Online' : 'Offline'}
          </p>
          {summary && <p className="mt-1 text-[15px] text-on-hero-2">{summary}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={online}
          aria-label="Online"
          aria-busy={busy}
          onClick={toggle}
          disabled={disabled}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-[#111113] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Power aria-hidden className="size-4" strokeWidth={2.5} />
          {busy ? 'Saving…' : online ? 'Go offline' : 'Go online'}
        </button>
      </div>

      {children && <div className="mt-5 grid grid-cols-2 gap-2.5">{children}</div>}

      <div aria-live="polite" className="empty:hidden">
        {!online && !canGoOnline && <p className="mt-3 text-sm text-on-hero-2">You can go online when the shift starts.</p>}
        {online && gps === 'on' && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-on-hero-2">
            <LocateFixed aria-hidden className="size-4" /> Sharing your location while you are online
          </p>
        )}
        {online && gps === 'idle' && <p className="mt-3 text-sm text-on-hero-2">Getting your location…</p>}
      </div>
      {online && gps === 'denied' && (
        <p role="alert" className="mt-3 rounded-2xl bg-white/10 p-3 text-sm font-medium text-[#ffc2b8]">
          Location is blocked. Turn it on in your browser settings so we can send you nearby pickups.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-white/10 p-3 text-sm font-medium text-[#ffc2b8]">
          {error}
        </p>
      )}
    </section>
  )
}

// A pill shortcut inside the hero card (e.g. My nights, Earnings).
export function HeroLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="press flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/[0.12] px-3 text-[15px] font-semibold text-on-hero ring-1 ring-white/15 transition hover:bg-white/20"
    >
      {icon}
      {children}
    </Link>
  )
}
