'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { Result } from '@/components/ops/kit'

// Shows a zone's price multiplier. Super Admin and Finance can change it; everyone else just sees it.
export default function ZoneMultiplierEditor({
  zoneId,
  value,
  canEdit,
}: {
  zoneId: string
  value: number
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(value))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function save() {
    setError('')
    setSaving(true)
    const res = await fetch(`/api/admin/zones/${zoneId}/multiplier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceMultiplier: input }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || 'Could not save the multiplier')
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-2">
          Price multiplier <strong className="font-semibold tabular-nums text-ink">×{value}</strong>
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setInput(String(value))
              setEditing(true)
            }}
            className="min-h-9 font-semibold text-ops-deep hover:underline"
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
          <span className="text-sm font-medium text-ink-2">Price multiplier (×)</span>
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
        <button type="button" onClick={save} disabled={saving} className={BUTTON_PRIMARY}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className={BUTTON_QUIET}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-3">Applies to new quotes only; orders already booked keep their price. The change is logged.</p>
      <Result msg={error ? { ok: false, text: error } : null} />
    </div>
  )
}
