'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Timer, X } from 'lucide-react'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { useNow } from '@/lib/use-now'

// Four common reasons (plus "Other"), few enough to choose one-handed.
const REASONS = ['Too far from my area', 'My vehicle is full', 'Vehicle problem or emergency', 'Not safe to go there tonight']

async function accept(orderIds: string[]): Promise<string> {
  try {
    const res = await fetch('/api/driver/orders/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds }),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok ? '' : data.error || 'Could not accept'
  } catch {
    return 'Could not reach Trashit. Please check your connection and try again.'
  }
}

function timeLeft(deadlineIso: string, now: number): string {
  const mins = Math.ceil((new Date(deadlineIso).getTime() - now) / 60_000)
  if (mins <= 0) return 'Time is up: this stop is about to go to another driver'
  if (mins < 60) return `Accept within ${mins} min, or it goes to another driver`
  return `Accept by ${new Date(deadlineIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, or it goes to another driver`
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`
}

// A live accept deadline. `big` shows a large mm:ss clock (the top card); otherwise one line.
export function AcceptCountdown({ deadline, big = false }: { deadline: string; big?: boolean }) {
  const now = useNow(big ? 1000 : 15_000)
  const left = now == null ? null : new Date(deadline).getTime() - now
  const urgent = left != null && left < 5 * 60_000

  if (big) {
    return (
      <div className="my-4">
        <p className="flex items-baseline gap-3">
          <span className={`text-5xl font-bold tabular-nums tracking-tight ${urgent ? 'text-danger' : 'text-action'}`}>{left == null ? '–:––' : clock(left)}</span>
          <span className="text-sm text-ink-3">{left == null || left > 0 ? 'left to accept' : 'time is up'}</span>
        </p>
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-line">
          <span
            className={`block h-full rounded-full ${urgent ? 'bg-danger' : 'bg-action'}`}
            style={{ width: `${left == null ? 100 : Math.max(0, Math.min(100, (left / (15 * 60_000)) * 100))}%` }}
          />
        </span>
        <p className="sr-only" aria-live="polite">
          {now != null && timeLeft(deadline, now)}
        </p>
      </div>
    )
  }

  return (
    <p className={`my-2 flex items-center gap-1.5 text-sm ${urgent ? 'font-semibold text-danger' : 'text-action-deep'}`}>
      <Timer aria-hidden className="size-4 shrink-0" /> {now == null ? 'Accept soon, or it goes to another driver' : timeLeft(deadline, now)}
    </p>
  )
}

// "Accept all" for every new stop at once.
export function AcceptAllButton({ orderIds }: { orderIds: string[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  return (
    <>
      <button
        onClick={async () => {
          setBusy(true)
          setError('')
          const err = await accept(orderIds)
          setBusy(false)
          if (err) setError(err)
          else router.refresh()
        }}
        disabled={busy}
        className={`w-full min-h-12 ${BUTTON_PRIMARY}`}
      >
        <Check aria-hidden className="size-5" strokeWidth={2.5} />
        {busy ? 'Accepting…' : orderIds.length === 1 ? 'Accept stop' : `Accept all ${orderIds.length} stops`}
      </button>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden className="size-4" /> {error}
        </p>
      )}
    </>
  )
}

// Accept or decline one stop. A declined stop leaves this driver's list and goes straight to another driver.
export default function StopResponse({ orderId, deadline }: { orderId: string; deadline: string | null }) {
  const [mode, setMode] = useState<'idle' | 'declining'>('idle')
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function decline() {
    const text = reason === 'Other' ? other.trim() : reason
    if (text.length < 3) {
      setError('Please choose or type a reason')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/driver/orders/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not decline')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'declining') {
    return (
      <div className="grid gap-3 rounded-card bg-danger-wash p-4">
        <p className="font-semibold">Why are you declining this stop?</p>
        <div className="grid gap-2" role="radiogroup" aria-label="Reason">
          {[...REASONS, 'Other'].map((r) => (
            <label
              key={r}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-[15px] ring-1 ${
                reason === r ? 'bg-surface ring-danger' : 'ring-line hover:bg-surface'
              }`}
            >
              <input type="radio" name={`reason-${orderId}`} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-danger)]" />
              {r}
            </label>
          ))}
        </div>
        {reason === 'Other' && (
          <input value={other} onChange={(e) => setOther(e.target.value)} className={FIELD} placeholder="Type the reason" aria-label="Your reason" />
        )}
        <p className="text-sm text-ink-3">The stop goes to another driver straight away and won&apos;t come back to you.</p>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
            <AlertCircle aria-hidden className="size-4" /> {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={decline} disabled={busy} className="min-h-12 rounded-control bg-danger px-4 font-semibold text-canvas disabled:opacity-60">
            {busy ? 'Declining…' : 'Decline stop'}
          </button>
          <button onClick={() => setMode('idle')} disabled={busy} className="min-h-12 rounded-control px-4 font-semibold ring-1 ring-line-strong">
            Keep it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {deadline && <AcceptCountdown deadline={deadline} />}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          onClick={async () => {
            setBusy(true)
            setError('')
            const err = await accept([orderId])
            setBusy(false)
            if (err) setError(err)
            else router.refresh()
          }}
          disabled={busy}
          className={`min-h-12 ${BUTTON_PRIMARY}`}
        >
          <Check aria-hidden className="size-5" strokeWidth={2.5} /> {busy ? 'Accepting…' : 'Accept'}
        </button>
        <button
          onClick={() => setMode('declining')}
          disabled={busy}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-control px-4 font-semibold text-danger ring-1 ring-danger/50"
        >
          <X aria-hidden className="size-4" /> Decline
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden className="size-4" /> {error}
        </p>
      )}
    </div>
  )
}
