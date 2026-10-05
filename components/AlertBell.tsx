'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronUp, X } from 'lucide-react'

export interface BellAlert {
  id: string
  title: string
  body: string
  url?: string | null
}

// A bell with the number of unread alerts. Tapping it opens a panel to read them; it collapses again with the
// arrow, Escape, or a tap outside. Uses the theme tokens, so it fits the driver (night) and ops (day) apps.
export default function AlertBell({
  alerts,
  onDismiss,
  label = 'Alerts',
}: {
  alerts: BellAlert[]
  onDismiss: (ids: string[]) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const count = alerts.length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={count ? `${label}: ${count} new` : `${label}: none`}
        className="press relative grid size-11 place-items-center rounded-full text-ink-2 ring-1 ring-line transition hover:bg-surface hover:text-ink"
      >
        <Bell aria-hidden className={`size-5 ${count ? 'text-action' : ''}`} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold tabular-nums leading-5 text-white ring-2 ring-canvas">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card bg-surface shadow-lift ring-1 ring-line"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">{label}</p>
            <div className="flex items-center gap-1">
              {count > 1 && (
                <button type="button" onClick={() => onDismiss(alerts.map((a) => a.id))} className="min-h-9 rounded-control px-2 text-sm font-medium text-ink-3 hover:text-ink">
                  Dismiss all
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Collapse" className="grid size-9 place-items-center rounded-control text-ink-3 hover:bg-canvas hover:text-ink">
                <ChevronUp aria-hidden className="size-4" />
              </button>
            </div>
          </div>
          {count === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-3">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-action" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">{a.title}</p>
                    <p className="mt-0.5 text-sm text-ink-2">{a.body}</p>
                    {a.url && (
                      <Link
                        href={a.url}
                        onClick={() => {
                          onDismiss([a.id])
                          setOpen(false)
                        }}
                        className="mt-1 inline-block text-sm font-semibold text-action-deep hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                  <button type="button" onClick={() => onDismiss([a.id])} aria-label="Dismiss" className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-canvas hover:text-ink">
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
