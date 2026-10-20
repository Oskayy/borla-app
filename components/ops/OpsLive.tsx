'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const CHECK_EVERY_MS = 15_000

// Keeps every ops page up to date by itself: every 15 seconds (while the tab is visible, and at once when you come
// back to it) it asks whether anything changed, and if so reloads the page's data in place. Lists, counts, charts
// and the menu badges update; what you are typing and what you have open stay as they are. While a text box has
// focus the refresh waits until you leave it.
export default function OpsLive() {
  const router = useRouter()
  const version = useRef<string | null>(null)
  const pending = useRef(false)
  const failures = useRef(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [state, setState] = useState<'live' | 'reconnecting'>('live')

  useEffect(() => {
    let stopped = false

    const typing = () => {
      const el = document.activeElement as HTMLElement | null
      return !!el && (el.isContentEditable || (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && (el as HTMLInputElement).type !== 'checkbox'))
    }

    const refresh = () => {
      if (typing()) {
        pending.current = true
        return
      }
      pending.current = false
      router.refresh()
      setUpdatedAt(new Date())
    }

    async function check() {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/ops/live', { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { version?: string }
        failures.current = 0
        setState('live')
        if (!data.version) return
        if (version.current === null) {
          version.current = data.version
          setUpdatedAt(new Date())
        } else if (data.version !== version.current) {
          version.current = data.version
          refresh()
        } else {
          setUpdatedAt(new Date())
        }
      } catch {
        failures.current++
        if (failures.current >= 2) setState('reconnecting')
      }
    }

    check()
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    const onBlur = () => pending.current && window.setTimeout(() => pending.current && refresh(), 300)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    document.addEventListener('focusout', onBlur)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('focusout', onBlur)
    }
  }, [router])

  const time = updatedAt?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const text = state === 'live' ? `Auto-updating${time ? ` · last checked ${time}` : ''}` : 'Reconnecting…'
  // A dot on most screens (the top bar is full); the words too on wide ones. Hover or a screen reader gives the words.
  return (
    <span
      role="status"
      aria-label={text}
      title={state === 'live' ? `This page updates by itself when anything changes. ${time ? `Last checked ${time}.` : ''}` : 'Lost touch with Trashit for a moment; trying again'}
      className={`hidden items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold lg:inline-flex 2xl:px-2.5 ${
        state === 'live' ? 'bg-action-wash text-action-deep' : 'bg-warn-wash text-warn-deep'
      }`}
    >
      <span aria-hidden className={`size-2 rounded-full bg-current ${state === 'live' ? 'motion-safe:animate-pulse' : ''}`} />
      <span aria-hidden className={state === 'live' ? 'hidden 2xl:inline' : ''}>
        {text}
      </span>
    </span>
  )
}
