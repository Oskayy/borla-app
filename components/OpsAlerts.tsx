'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const CHECK_EVERY_MS = 30_000

interface Alert {
  id: string
  title: string
  body: string
  url: string | null
}

function ring() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.25
      gain.gain.setValueAtTime(0.25, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t)
      osc.stop(t + 0.23)
    })
  } catch {
    // no sound available
  }
}

// Messages for ops (tonight's plan is ready, an order needs a driver, the night finished), on every ops page.
export default function OpsAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const seen = useRef(new Set<string>())

  useEffect(() => {
    async function check() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/ops/alerts', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list: Alert[] = data.alerts ?? []
        if (list.some((a) => !seen.current.has(a.id))) {
          list.forEach((a) => seen.current.add(a.id))
          ring()
        }
        setAlerts(list)
      } catch {
        // try again next time
      }
    }
    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  async function dismiss(ids: string[]) {
    setAlerts((prev) => prev.filter((a) => !ids.includes(a.id)))
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
  }

  if (alerts.length === 0) return null
  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map((a) => (
        <div
          key={a.id}
          role="alert"
          style={{ borderRadius: 6, padding: '10px 12px', background: '#FFF6E5', border: '1px solid var(--color-accent)', display: 'flex', gap: 12, alignItems: 'flex-start' }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>🔔 {a.title}</p>
            <p style={{ fontSize: 13 }}>{a.body}</p>
            {a.url && (
              <Link href={a.url} onClick={() => dismiss([a.id])} style={{ fontSize: 13 }}>
                Open
              </Link>
            )}
          </div>
          <button
            onClick={() => dismiss([a.id])}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
