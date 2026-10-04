'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const CHECK_EVERY_MS = 20_000

interface Alert {
  id: string
  title: string
  body: string
}

// Plays a short two-tone ring. Browsers only allow sound after the driver has tapped the page once.
function ring() {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    ;[880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.25
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t)
      osc.stop(t + 0.23)
    })
  } catch {
    // no sound available; the banner and vibration still show
  }
  try {
    navigator.vibrate?.([300, 100, 300])
  } catch {
    // ignore
  }
}

// Keeps the driver's screen up to date while it's open: reloads when stops are added, taken away or changed,
// and shows (and rings for) new messages such as "New stop added to your route".
export default function DriverLiveUpdates({ initialVersion }: { initialVersion: string }) {
  const version = useRef(initialVersion)
  const seen = useRef(new Set<string>())
  const [alerts, setAlerts] = useState<Alert[]>([])
  const router = useRouter()

  useEffect(() => {
    version.current = initialVersion
  }, [initialVersion])

  useEffect(() => {
    let stopped = false

    async function check() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/driver/updates', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const fresh: Alert[] = (data.alerts ?? []).filter((a: Alert) => !seen.current.has(a.id))
        if (fresh.length > 0) {
          fresh.forEach((a) => seen.current.add(a.id))
          setAlerts((prev) => [...fresh, ...prev].slice(0, 5))
          ring()
        }
        if (data.version && data.version !== version.current) {
          version.current = data.version
          router.refresh()
        }
      } catch {
        // offline for a moment; try again next time
      }
    }

    check()
    const timer = setInterval(() => !stopped && check(), CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  async function dismiss() {
    const ids = alerts.map((a) => a.id)
    setAlerts([])
    await fetch('/api/driver/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
  }

  if (alerts.length === 0) return null
  return (
    <div
      role="alert"
      style={{ marginBottom: 16, borderRadius: 8, padding: 12, background: '#FFF6E5', border: '2px solid var(--color-accent)' }}
    >
      {alerts.map((a) => (
        <div key={a.id} style={{ marginBottom: 6 }}>
          <p style={{ fontWeight: 600, fontSize: 14 }}>🔔 {a.title}</p>
          <p style={{ fontSize: 13 }}>{a.body}</p>
        </div>
      ))}
      <button onClick={dismiss} className="btn-primary" style={{ width: '100%', marginTop: 4 }}>
        OK
      </button>
    </div>
  )
}
