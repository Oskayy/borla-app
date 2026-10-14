'use client'

import { useEffect, useState } from 'react'
import { BellOff, BellRing, CheckCircle2 } from 'lucide-react'
import { useClientValue } from '@/lib/use-client-value'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type State = 'checking' | 'unsupported' | 'off' | 'on' | 'blocked' | 'working'

const DEFAULT_MESSAGE = 'Turn on alerts so your phone rings when stops are added to your route, even when Trashit is closed.'

// "Turn on alerts": lets Trashit ring this phone or computer (new stops for drivers, plan ready for ops,
// pickup moved for customers), even with the app closed.
// `explain` (settings screens): always show the current state in words, what it does, and how to change it.
export default function EnableAlerts({
  message = DEFAULT_MESSAGE,
  compact = false,
  explain = false,
}: {
  message?: string
  compact?: boolean
  explain?: boolean
}) {
  // What the browser rules out before we ask anything (read on the client only).
  const support = useClientValue<'ok' | 'unsupported' | 'blocked'>(() => {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'unsupported'
    }
    return Notification.permission === 'denied' ? 'blocked' : 'ok'
  }, 'ok')
  const [checked, setState] = useState<State>('checking')
  const [error, setError] = useState('')
  const state: State = support === 'ok' ? checked : support

  useEffect(() => {
    if (support !== 'ok') return
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (sub) {
          // Re-save in case another account used this phone before.
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub.toJSON()),
          }).catch(() => {})
          setState('on')
        } else {
          setState('off')
        }
      })
      .catch(() => setState('unsupported'))
  }, [support])

  async function turnOn() {
    setError('')
    setState('working')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!).buffer as ArrayBuffer }))
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error('save failed')
      setState('on')
    } catch {
      setError('Could not turn on alerts. Please try again.')
      setState('off')
    }
  }

  if (explain) {
    const row = (icon: React.ReactNode, title: string, text: string) => (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <p className="text-[15px]">
          <span className="block font-semibold text-ink">{title}</span>
          <span className="block text-ink-2">{text}</span>
        </p>
      </div>
    )
    if (state === 'checking') return <p className="text-sm text-ink-3">Checking this phone…</p>
    if (state === 'on') {
      return row(
        <CheckCircle2 aria-hidden className="size-5 text-customer" />,
        'On for this phone',
        "You'll get alerts even when Trashit is closed. To stop them, turn off notifications for Trashit in your phone's settings."
      )
    }
    if (state === 'blocked') {
      return row(
        <BellOff aria-hidden className="size-5 text-danger" />,
        'Blocked on this phone',
        "Notifications for Trashit were turned off on this phone. To get alerts, allow notifications for Trashit in your phone's or browser's settings, then come back here."
      )
    }
    if (state === 'unsupported') {
      return row(
        <BellOff aria-hidden className="size-5 text-ink-3" />,
        "This browser can't show alerts",
        'Updates still appear in Trashit when you open it. On iPhone, add Trashit to your home screen first, then open it from there.'
      )
    }
  }

  if (state === 'checking' || state === 'on') return null
  if (compact && (state === 'unsupported' || state === 'blocked')) return null
  if (state === 'unsupported') {
    return (
      <p className="text-sm text-ink-3">
        This browser can&apos;t show alerts when Trashit is closed. Keep Trashit open during your shift. (On iPhone, add Trashit to your home
        screen first.)
      </p>
    )
  }
  if (state === 'blocked') {
    return (
      <p className="text-sm text-danger">
        Alerts are blocked for Trashit. Allow notifications in your browser settings so you don&apos;t miss an update.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-line/70">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-action-wash text-action-deep">
        <BellRing aria-hidden className="size-5" />
      </span>
      <p className="min-w-[12rem] flex-1 text-[15px] text-ink-2">{message}</p>
      <button
        onClick={turnOn}
        disabled={state === 'working'}
        className="inline-flex min-h-11 items-center gap-2 rounded-control bg-action px-4 text-[15px] font-semibold text-on-action transition hover:brightness-95 disabled:opacity-60"
      >
        {state === 'working' ? 'Turning on…' : 'Turn on alerts'}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
