'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Chip } from '@/components/ops/kit'

// "Make active" and "Delete" on a payout or pricing rule in its History list.
export default function RuleActions({ kind, id, active, label }: { kind: 'payout' | 'pricing'; id: string; active: boolean; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const url = `/api/admin/${kind}-rules/${id}`

  async function call(init: RequestInit) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(url, init)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not save')
      else router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (active) return <Chip tone="ops">Active</Chip>
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm(`Make "${label}" the active ${kind} rule? It applies to new ${kind === 'payout' ? 'pickups and unloads' : 'quotes'} from now on.`))
              call({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'activate' }) })
          }}
          className="min-h-10 rounded-control px-3 text-sm font-semibold text-action-deep ring-1 ring-action-deep/40 transition hover:bg-action-wash disabled:opacity-60"
        >
          Make active
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm(`Delete "${label}"? This can't be undone.`) && call({ method: 'DELETE' })}
          aria-label={`Delete ${label}`}
          title="Delete"
          className="grid size-10 place-items-center rounded-control text-ink-3 transition hover:bg-danger-wash hover:text-danger disabled:opacity-60"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </span>
      <span aria-live="polite" className="text-xs text-danger empty:hidden">
        {error}
      </span>
    </span>
  )
}
