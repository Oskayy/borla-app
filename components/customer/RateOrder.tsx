'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { MAX_COMMENT } from '@/lib/ratings'

const WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent']

// Stars and an optional comment for a collected pickup. Sent once; the driver sees it without the customer's name.
export default function RateOrder({ orderId, driverName }: { orderId: string; driverName: string }) {
  const router = useRouter()
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!stars) {
      setError('Choose a number of stars')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, comment }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not send. Please try again.')
        setSaving(false)
        return
      }
      router.refresh()
    } catch {
      setError('No connection. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={send}>
      <fieldset>
        <legend className="text-base font-semibold tracking-tight">How was your pickup with {driverName}?</legend>
        <div className="mt-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="stars"
                value={n}
                checked={stars === n}
                onChange={() => {
                  setStars(n)
                  setError('')
                }}
                className="peer sr-only"
              />
              <span className="grid size-12 place-items-center rounded-control peer-focus-visible:ring-3 peer-focus-visible:ring-action/40">
                <Star aria-hidden className={`size-8 transition duration-200 ease-[var(--ease-spring)] ${n <= stars ? 'scale-110 fill-warn text-warn' : 'text-line-strong hover:scale-105'}`} />
              </span>
              <span className="sr-only">
                {n} {n === 1 ? 'star' : 'stars'}, {WORDS[n]}
              </span>
            </label>
          ))}
          <span className="ml-2 text-[15px] font-medium text-ink-2" aria-hidden>
            {WORDS[stars]}
          </span>
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-ink-2">Anything to add? (optional)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX_COMMENT}
          rows={3}
          className={`${FIELD} mt-1.5 resize-y`}
          placeholder="e.g. Came on time and closed the gate"
        />
      </label>
      <p className="mt-1.5 text-sm text-ink-3">Your driver sees the stars and comment, but not your name. You can only rate once.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
          {saving ? 'Sending…' : 'Send rating'}
        </button>
        <p aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      </div>
    </form>
  )
}
