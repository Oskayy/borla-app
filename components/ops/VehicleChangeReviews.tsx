'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Phone } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { AllClear, PANEL, Result, SectionTitle } from '@/components/ops/kit'
import { DocPhoto } from '@/components/DriverApprovalsClient'
import { dateTimeLabel } from '@/lib/format'

export interface VehicleChangeRow {
  id: string // driver id
  name: string
  phone: string
  plate: string | null
  from: { name: string; capacityLitres: number } | null
  to: { name: string; capacityLitres: number } | null
  sentAt: string
  oldPhoto: string | null // signed URLs
  newPhoto: string | null
}

// Driver Approvals: approved drivers asking to switch vehicle type. Approving changes the capacity dispatch plans with.
export default function VehicleChangeReviews({ rows }: { rows: VehicleChangeRow[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/drivers/${id}/vehicle-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[id] ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg((m) => ({
        ...m,
        [id]: res.ok ? { ok: true, text: decision === 'approve' ? 'Approved.' : 'Sent back to the driver.' } : { ok: false, text: data.error || 'Could not save' },
      }))
      if (res.ok) router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  const vehicle = (v: VehicleChangeRow['from']) => (v ? `${v.name} (${v.capacityLitres.toLocaleString()} L)` : 'No vehicle')

  return (
    <section aria-labelledby="h-vc">
      <SectionTitle id="h-vc" count={rows.length} hint="These drivers are approved and keep working on their current vehicle until you decide. Check the photo shows the new vehicle type.">
        Vehicle changes to approve
      </SectionTitle>
      {rows.length === 0 && <AllClear>No vehicle changes waiting.</AllClear>}
      <ul className="grid gap-3 empty:hidden">
        {rows.map((r) => (
          <li key={r.id} className={PANEL}>
            <h3 className="text-lg font-semibold tracking-tight">{r.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-medium text-ops-deep hover:underline">
                <Phone aria-hidden className="size-3.5" /> {r.phone}
              </a>
              {r.plate && <span>Plate {r.plate}</span>}
              <span className="text-ink-3">Sent {dateTimeLabel(r.sentAt)}</span>
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
              <span className="text-ink-2">{vehicle(r.from)}</span>
              <ArrowRight aria-label="to" className="size-4 text-ink-3" />
              <strong className="font-semibold">{r.to ? vehicle(r.to) : 'Unknown vehicle'}</strong>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <DocPhoto url={r.oldPhoto} label="Current vehicle" />
              <DocPhoto url={r.newPhoto} label="New vehicle" />
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <label className="block">
                <span className="text-sm font-medium text-ink-2">Note to the driver (required to send back)</span>
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                  placeholder="e.g. Photo doesn't show the whole vehicle"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button type="button" onClick={() => decide(r.id, 'approve')} disabled={busy === r.id} className={BUTTON_PRIMARY}>
                  Approve change
                </button>
                <button type="button" onClick={() => decide(r.id, 'reject')} disabled={busy === r.id} className={BUTTON_DANGER}>
                  Send back
                </button>
              </div>
            </div>
            <Result msg={msg[r.id]} />
          </li>
        ))}
      </ul>
    </section>
  )
}
