'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Moon } from 'lucide-react'
import { BUTTON_PRIMARY } from '@/components/ui'
import { NIGHT_NAMES, upcomingNights, type Availability } from '@/lib/availability'

// Monday first, the way a working week reads.
const WEEK = [1, 2, 3, 4, 5, 6, 0]

function nightLabel(ymd: string, tonight: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  const day = d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' })
  const date = d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  return ymd === tonight ? `Tonight, ${date}` : `${day} ${date}`
}

export default function AvailabilityForm({ initial, tonight, stopsTonight }: { initial: Availability; tonight: string; stopsTonight: number }) {
  const router = useRouter()
  const [workNights, setWorkNights] = useState<number[]>(initial.workNights)
  const [nightsOff, setNightsOff] = useState<string[]>(initial.nightsOff)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const changed =
    [...workNights].sort().join() !== [...initial.workNights].sort().join() || [...nightsOff].sort().join() !== [...initial.nightsOff].sort().join()
  const coming = upcomingNights({ workNights, nightsOff }, tonight, 14)
  const offTonight = !coming[0].working

  function toggleWeekly(n: number) {
    setMessage(null)
    setWorkNights((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n]))
  }
  function toggleNight(date: string) {
    setMessage(null)
    setNightsOff((o) => (o.includes(date) ? o.filter((x) => x !== date) : [...o, date]))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/driver/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workNights, nightsOff }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? 'Could not save. Please try again.' })
      } else {
        setMessage({ ok: true, text: 'Saved. Dispatch will plan around these nights.' })
        router.refresh()
      }
    } catch {
      setMessage({ ok: false, text: 'No connection. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className="text-base font-semibold tracking-tight">Nights you work each week</legend>
        <p className="mt-1 text-sm text-ink-3">A night is named by the evening it starts: Friday is Friday 8pm to Saturday morning.</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WEEK.map((n) => {
            const on = workNights.includes(n)
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => toggleWeekly(n)}
                className={`flex min-h-12 items-center justify-center gap-1.5 rounded-control px-2 text-[15px] font-semibold transition ${
                  on ? 'bg-action text-on-action' : 'text-ink-3 ring-1 ring-line-strong hover:text-ink'
                }`}
              >
                {on && <Check aria-hidden className="size-4" strokeWidth={3} />}
                {NIGHT_NAMES[n].slice(0, 3)}
                <span className="sr-only">{on ? ' (working)' : ' (off)'}</span>
              </button>
            )
          })}
        </div>
        {workNights.length === 0 && <p className="mt-2 text-sm text-action-deep">With no nights chosen, you won&apos;t be given any stops.</p>}
      </fieldset>

      <div>
        <h3 className="text-base font-semibold tracking-tight">The next two weeks</h3>
        <p className="mt-1 text-sm text-ink-3">Take a single night off without changing your week.</p>
        <ul className="mt-3 divide-y divide-line">
          {coming.map((c) => (
            <li key={c.date} className="flex min-h-14 items-center justify-between gap-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <Moon aria-hidden className={`size-4 shrink-0 ${c.working ? 'text-action' : 'text-ink-3'}`} />
                <span className="min-w-0">
                  <span className={`block font-medium ${c.working ? '' : 'text-ink-3'}`}>{nightLabel(c.date, tonight)}</span>
                  <span className="block text-sm text-ink-3">{c.working ? 'Working' : c.weekly ? 'Night off' : 'Not one of your nights'}</span>
                </span>
              </span>
              {c.weekly && (
                <button
                  type="button"
                  onClick={() => toggleNight(c.date)}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-ink-2 ring-1 ring-line-strong hover:bg-canvas"
                >
                  {c.working ? 'Take off' : 'Work it'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {offTonight && stopsTonight > 0 && (
        <p className="rounded-control bg-driver-wash p-3.5 text-[15px] text-ink">
          You still have {stopsTonight} {stopsTonight === 1 ? 'stop' : 'stops'} tonight. Being off stops new ones coming; decline these on Tonight so they
          go to another driver.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !changed} className={BUTTON_PRIMARY}>
          {saving ? 'Saving…' : 'Save availability'}
        </button>
        <p aria-live="polite" className={`text-sm ${message?.ok ? 'text-ink-2' : 'text-danger'}`}>
          {message?.text}
        </p>
      </div>
    </div>
  )
}
