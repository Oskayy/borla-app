'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { Result } from '@/components/ops/kit'
import { tierLabel } from '@/lib/tier-price'

// Shows a zone's price multiplier: its tier's (set on the Pricing page) or its own. Super Admin and Finance can give
// the zone its own price or put it back on its tier's; everyone else just sees it.
export default function ZoneMultiplierEditor({
  zoneId,
  value,
  followsTier,
  tier,
  tierPrice,
  canEdit,
}: {
  zoneId: string
  value: number
  followsTier: boolean
  tier: string
  tierPrice: number
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(value))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function save(body: { priceMultiplier: string } | { followTier: true }) {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/zones/${zoneId}/multiplier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'Could not save the price')
      setEditing(false)
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const how = followsTier ? `${tierLabel(tier)} tier price` : 'own price'
  if (!editing) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-2">
          Price <strong className="font-semibold tabular-nums text-ink">×{value}</strong> <span className="text-ink-3">({how})</span>
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setInput(String(value))
              setEditing(true)
            }}
            className="min-h-9 font-semibold text-action-deep hover:underline"
          >
            Change
          </button>
        )}
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-control bg-canvas p-3.5">
      <div className="flex flex-wrap items-end gap-2.5">
        <label>
          <span className="text-sm font-medium text-ink-2">Own price (×)</span>
          <input
            type="number"
            step="0.05"
            min="0.5"
            max="5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={`${FIELD} mt-1.5 w-28 tabular-nums`}
          />
        </label>
        <button type="button" onClick={() => save({ priceMultiplier: input })} disabled={saving} className={BUTTON_PRIMARY}>
          {saving ? 'Saving…' : 'Save own price'}
        </button>
        {!followsTier && (
          <button type="button" onClick={() => save({ followTier: true })} disabled={saving} className={BUTTON_QUIET}>
            Use the {tierLabel(tier)} price (×{tierPrice})
          </button>
        )}
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className={BUTTON_QUIET}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-3">
        {followsTier
          ? `This zone follows the ${tierLabel(tier)} price. An own price stays put when tier prices change.`
          : 'Tier prices are set on the Pricing page.'}{' '}
        Applies to new quotes only; orders already booked keep their price. The change is logged.
      </p>
      <Result msg={error ? { ok: false, text: error } : null} />
    </div>
  )
}
