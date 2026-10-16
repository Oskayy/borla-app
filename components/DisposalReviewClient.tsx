'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ImageOff, Phone } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { dateTimeLabel } from '@/lib/format'

export interface ReviewGroup {
  key: string
  kind: 'review' | 'never_unloaded' // photo to check, or collected and never confirmed as unloaded
  driverName: string
  driverPhone: string
  siteName: string | null
  why: string
  photoUrl: string | null
  submittedAt: string
  orders: { id: string; address: string; litres: number | null }[]
}

export default function DisposalReviewClient({ groups, canRefund = false }: { groups: ReviewGroup[]; canRefund?: boolean }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function decide(g: ReviewGroup, decision: 'approve' | 'reject' | 'driver_fault') {
    setBusy(g.key)
    try {
      const res = await fetch('/api/admin/disposal-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: g.orders.map((o) => o.id), decision, note: notes[g.key] ?? '', kind: g.kind }),
      })
      const data = await res.json().catch(() => ({}))
      setMessages((m) => ({
        ...m,
        [g.key]: res.ok
          ? {
              ok: true,
              text:
                decision === 'approve'
                  ? `Approved. GHS ${Number(data.paid ?? 0).toFixed(2)} released to the driver.`
                  : decision === 'driver_fault'
                  ? 'Refund started. The pickup share is taken back once the refund goes through.'
                  : 'Sent back to the driver.',
            }
          : { ok: false, text: data.error || 'Could not save' },
      }))
      if (res.ok) router.refresh()
    } catch {
      setMessages((m) => ({ ...m, [g.key]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  if (groups.length === 0) {
    return (
      <p className="flex items-center gap-2.5 rounded-card bg-surface p-5 text-[15px] text-ink-2 shadow-card ring-1 ring-line/70">
        <CheckCircle2 aria-hidden className="size-5 text-action-deep" /> Nothing to check. Every unload so far was confirmed at the site.
      </p>
    )
  }

  return (
    <ul className="grid gap-4">
      {groups.map((g) => {
        const litres = g.orders.reduce((n, o) => n + (o.litres ?? 0), 0)
        const msg = messages[g.key]
        return (
          <li key={g.key} className="grid gap-5 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70 sm:grid-cols-[220px_1fr] sm:p-6">
            {g.photoUrl ? (
              <a href={g.photoUrl} target="_blank" rel="noopener noreferrer" className="block self-start overflow-hidden rounded-control ring-1 ring-line">
                <Image src={g.photoUrl} alt={`Unload photo from ${g.driverName}`} width={440} height={330} unoptimized className="aspect-[4/3] w-full object-cover" />
                <span className="block bg-canvas px-3 py-1.5 text-xs font-medium text-ink-3">Open full size</span>
              </a>
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-control bg-canvas text-sm text-ink-3 ring-1 ring-line">
                <span className="flex flex-col items-center gap-1.5">
                  <ImageOff aria-hidden className="size-5" /> No photo
                </span>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{g.driverName}</h2>
                <span className="text-sm text-ink-3">
                  {g.kind === 'never_unloaded' ? 'Collected' : 'Sent'} {dateTimeLabel(g.submittedAt)}
                </span>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                {g.driverPhone && (
                  <a href={`tel:${g.driverPhone}`} className="inline-flex items-center gap-1 font-medium text-action-deep hover:underline">
                    <Phone aria-hidden className="size-3.5" /> {g.driverPhone}
                  </a>
                )}
                <span>Planned site: {g.siteName ?? 'none'}</span>
              </p>

              <p className="mt-3 flex items-start gap-2 rounded-control bg-danger-wash p-3 text-sm text-ink">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                <span>{g.why}</span>
              </p>

              <p className="mt-4 text-sm font-medium text-ink-2">
                {g.orders.length} {g.orders.length === 1 ? 'order' : 'orders'} in this load{litres > 0 && ` · ${litres} L`}
              </p>
              <ul className="mt-1.5 divide-y divide-line text-[15px]">
                {g.orders.map((o) => (
                  <li key={o.id} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">{o.address}</span>
                    {o.litres != null && <span className="shrink-0 tabular-nums text-ink-3">{o.litres} L</span>}
                  </li>
                ))}
              </ul>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-ink-2">
                  {g.kind === 'never_unloaded' ? 'Note (required if the driver was at fault)' : 'Note (required to reject)'}
                </span>
                <input
                  value={notes[g.key] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [g.key]: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                  placeholder={g.kind === 'never_unloaded' ? 'e.g. Called the driver: dumped by the roadside' : 'e.g. Photo shows a roadside, not the site'}
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    confirm(`Approve this unload and pay ${g.driverName} the unload share for ${g.orders.length} ${g.orders.length === 1 ? 'order' : 'orders'}?`) &&
                    decide(g, 'approve')
                  }
                  disabled={busy === g.key}
                  className={BUTTON_PRIMARY}
                >
                  Approve and pay {g.driverName.split(/\s+/)[0]}
                </button>
                {g.kind === 'review' ? (
                  <button type="button" onClick={() => decide(g, 'reject')} disabled={busy === g.key} className={BUTTON_DANGER}>
                    Send back
                  </button>
                ) : (
                  canRefund && (
                    <button
                      type="button"
                      onClick={() =>
                        confirm(
                          `Refund the customer in full for ${g.orders.length} ${g.orders.length === 1 ? 'order' : 'orders'}, cancel, and take back ${g.driverName.split(/\s+/)[0]}'s pickup pay?`
                        ) && decide(g, 'driver_fault')
                      }
                      disabled={busy === g.key || (notes[g.key] ?? '').trim().length < 3}
                      className={BUTTON_DANGER}
                    >
                      Driver at fault: refund
                    </button>
                  )
                )}
              </div>
              <p aria-live="polite" className={`mt-2 text-sm ${msg?.ok ? 'text-action-deep' : 'text-danger'}`}>
                {msg?.text}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
