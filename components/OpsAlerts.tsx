'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'

const CHECK_EVERY_MS = 30_000
const SHOWN = 2 // alerts shown before "Show more", so old ones never bury the page

interface Alert {
  id: string
  title: string
  body: string
  url: string | null
}

function ring() {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
  const [showAll, setShowAll] = useState(false)

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
  const hidden = showAll ? 0 : Math.max(0, alerts.length - SHOWN)
  return (
    <div className="mb-6 grid gap-2">
      {(showAll ? alerts : alerts.slice(0, SHOWN)).map((a) => (
        <div key={a.id} role="alert" className="flex items-start gap-3 rounded-card bg-ops-wash p-4 ring-1 ring-ops/25">
          <Bell aria-hidden className="mt-0.5 size-4 shrink-0 text-ops-deep" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{a.title}</p>
            <p className="mt-0.5 text-sm text-ink-2">{a.body}</p>
            {a.url && (
              <Link href={a.url} onClick={() => dismiss([a.id])} className="mt-1.5 inline-block text-sm font-semibold text-ops-deep hover:underline">
                Open
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss([a.id])}
            aria-label="Dismiss"
            className="-m-1.5 grid size-9 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-white/60 hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
      {alerts.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm">
          {hidden > 0 && (
            <button type="button" onClick={() => setShowAll(true)} className="min-h-9 font-semibold text-ops-deep hover:underline">
              Show {hidden} more {hidden === 1 ? 'alert' : 'alerts'}
            </button>
          )}
          <button type="button" onClick={() => dismiss(alerts.map((a) => a.id))} className="min-h-9 font-medium text-ink-3 hover:text-ink">
            Dismiss all
          </button>
        </div>
      )}
    </div>
  )
}
