'use client'

import { useEffect, useState } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type State = 'checking' | 'unsupported' | 'off' | 'on' | 'blocked' | 'working'

const DEFAULT_MESSAGE = 'Turn on alerts so your phone rings when stops are added to your route, even when Borla is closed.'

// "Turn on alerts": lets Borla ring this phone or computer (new stops for drivers, plan ready for ops,
// pickup moved for customers), even with the app closed.
export default function EnableAlerts({ message = DEFAULT_MESSAGE, compact = false }: { message?: string; compact?: boolean }) {
  const [state, setState] = useState<State>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }
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
  }, [])

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
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        This browser can&apos;t show alerts when Borla is closed. Keep Borla open during your shift. (On iPhone, add Borla to
        your home screen first.)
      </p>
    )
  }
  if (state === 'blocked') {
    return (
      <p style={{ fontSize: 12, color: '#B3261E', marginBottom: 12 }}>
        Alerts are blocked for Borla. Allow notifications in your browser settings so you don&apos;t miss new stops.
      </p>
    )
  }
  return (
    <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid var(--color-accent)' }}>
      <p style={{ fontSize: 14, marginBottom: 8 }}>{message}</p>
      <button onClick={turnOn} disabled={state === 'working'} className="btn-accent" style={{ width: compact ? 'auto' : '100%' }}>
        {state === 'working' ? 'Turning on...' : '🔔 Turn on alerts'}
      </button>
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  )
}
