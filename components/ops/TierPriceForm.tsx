'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { PANEL, Result } from '@/components/ops/kit'
import { MULTIPLIER_MAX, MULTIPLIER_MIN, TIER_LIST, tierLabel, type TierPrices } from '@/lib/tier-price'

// Default price multiplier per zone tier. Zones that follow their tier take it at once; zones with their own price
// keep it (Zones page). Only new bookings are affected.
export default function TierPriceForm({ current, following }: { current: TierPrices; following: Record<string, number> }) {
  const [v, setV] = useState(Object.fromEntries(TIER_LIST.map((t) => [t, String(current[t])])) as Record<string, string>)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  const changed = TIER_LIST.filter((t) => Number(v[t]) !== current[t])
  const affected = changed.reduce((n, t) => n + (following[t] ?? 0), 0)

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/tier-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(TIER_LIST.map((t) => [t, Number(v[t])]))),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setMsg({ ok: false, text: data.error || 'Could not save' })
      setMsg({
        ok: true,
        text: data.changed ? `Saved. ${data.zonesUpdated} ${data.zonesUpdated === 1 ? 'zone uses' : 'zones use'} the new prices for new bookings.` : 'Nothing changed.',
      })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="h-tier-prices" className={PANEL}>
      <h2 id="h-tier-prices" className="text-base font-semibold tracking-tight">
        Tier prices
      </h2>
      <p className="mt-1 text-sm text-ink-3">
        The multiplier for each kind of area. A zone that follows its tier uses this number; a zone with its own price (set on the Zones page)
        keeps that. 1.0 is the normal price, 1.3 is 30% more, 0.85 is 15% less. Orders already priced keep their price.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {TIER_LIST.map((t) => (
          <label key={t}>
            <span className="text-sm font-medium text-ink-2">{tierLabel(t)} (×)</span>
            <input
              type="number"
              min={MULTIPLIER_MIN}
              max={MULTIPLIER_MAX}
              step={0.05}
              value={v[t]}
              onChange={(e) => setV((s) => ({ ...s, [t]: e.target.value }))}
              className={`${FIELD} mt-1.5 tabular-nums`}
            />
            <span className="mt-1 block text-xs text-ink-3">
              {following[t] ?? 0} {(following[t] ?? 0) === 1 ? 'zone follows' : 'zones follow'} this
            </span>
          </label>
        ))}
      </div>
      <Result msg={msg} />
      <button
        type="button"
        disabled={busy || changed.length === 0}
        onClick={() => confirm(`Change the tier prices? ${affected} ${affected === 1 ? 'zone changes' : 'zones change'} price for every new booking.`) && save()}
        className={`${BUTTON_PRIMARY} mt-4`}
      >
        {busy ? 'Saving…' : 'Save tier prices'}
      </button>
    </section>
  )
}
