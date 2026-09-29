'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const REASONS = [
  'Too far from my area',
  'My vehicle is full',
  'Vehicle problem',
  'Not safe to go there tonight',
  'Personal emergency',
]

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
    return 'Could not reach Borla. Please check your connection and try again.'
  }
}

function timeLeft(deadlineIso: string): string {
  const mins = Math.ceil((new Date(deadlineIso).getTime() - Date.now()) / 60_000)
  if (mins <= 0) return 'Time is up: this stop is about to go to another driver'
  if (mins < 60) return `Accept within ${mins} min, or it goes to another driver`
  return `Accept by ${new Date(deadlineIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, or it goes to another driver`
}

// A live "accept within 12 min" line.
export function AcceptCountdown({ deadline }: { deadline: string }) {
  const [text, setText] = useState(() => timeLeft(deadline))
  useEffect(() => {
    setText(timeLeft(deadline))
    const t = setInterval(() => setText(timeLeft(deadline)), 15_000)
    return () => clearInterval(t)
  }, [deadline])
  const urgent = new Date(deadline).getTime() - Date.now() < 5 * 60_000
  return <p style={{ fontSize: 12, color: urgent ? '#B3261E' : '#9A6415', fontWeight: urgent ? 600 : 400, margin: '4px 0 6px' }}>⏱ {text}</p>
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
        className="btn-accent"
        style={{ width: '100%', marginTop: 8 }}
      >
        {busy ? 'Accepting...' : `Accept all ${orderIds.length} stop(s)`}
      </button>
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 6 }}>{error}</p>}
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
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'declining') {
    return (
      <div style={{ background: '#FBEDEC', borderRadius: 4, padding: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Why are you declining this stop?</p>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" style={{ marginBottom: 6 }}>
          <option value="">Choose a reason</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
        {reason === 'Other' && (
          <input value={other} onChange={(e) => setOther(e.target.value)} className="input-field" placeholder="Type the reason" style={{ marginBottom: 6 }} />
        )}
        <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>The stop goes to another driver straight away and won&apos;t come back to you.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={decline}
            disabled={busy}
            style={{ background: '#B3261E', color: 'white', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
          >
            {busy ? 'Declining...' : 'Decline stop'}
          </button>
          <button
            onClick={() => setMode('idle')}
            disabled={busy}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
          >
            Keep it
          </button>
        </div>
        {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 6 }}>{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {deadline && <AcceptCountdown deadline={deadline} />}
      <div style={{ display: 'flex', gap: 8 }}>
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
          className="btn-accent"
          style={{ flex: 1 }}
        >
          {busy ? '...' : 'Accept'}
        </button>
        <button
          onClick={() => setMode('declining')}
          disabled={busy}
          style={{ flex: 1, background: 'none', border: '1px solid #B3261E', color: '#B3261E', borderRadius: 4, padding: '8px 14px', fontSize: 14 }}
        >
          Decline
        </button>
      </div>
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  )
}
