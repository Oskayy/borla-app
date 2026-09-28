'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <p style={{ fontSize: 13, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>
          Price multiplier: <strong>×{value}</strong>
        </span>
        {canEdit && (
          <button
            onClick={() => {
              setInput(String(value))
              setEditing(true)
            }}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', fontSize: 12, padding: 0 }}
          >
            Change
          </button>
        )}
      </p>
    )
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>Price multiplier ×</span>
        <input
          type="number"
          step="0.05"
          min="0.5"
          max="5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ width: 80, padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 4 }}
        />
        <button onClick={save} disabled={saving} className="btn-accent" style={{ padding: '4px 12px', fontSize: 12 }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 10px', fontSize: 12 }}
        >
          Cancel
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
        Applies to new quotes only. Orders already booked keep their price. This change is logged.
      </p>
      {error && <p style={{ color: '#B3261E', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  )
}
