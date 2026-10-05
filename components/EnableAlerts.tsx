'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
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
export default function EnableAlerts({ message = DEFAULT_MESSAGE, compact = false }: { message?: string; compact?: boolean }) {
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
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 ring-1 ring-line">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-customer-wash text-customer-deep">
        <BellRing aria-hidden className="size-5" />
      </span>
      <p className="min-w-[12rem] flex-1 text-[15px] text-ink-2">{message}</p>
      <button
        onClick={turnOn}
        disabled={state === 'working'}
        className="inline-flex min-h-11 items-center gap-2 rounded-control bg-customer px-4 text-[15px] font-semibold text-white transition hover:bg-customer-deep disabled:opacity-60"
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
