'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageOff, Phone } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { AllClear, Chip, PANEL, Result, SectionTitle } from '@/components/ops/kit'
import { dateLabel, dateTimeLabel } from '@/lib/format'

export interface ApplicantRow {
  id: string
  name: string
  phone: string
  email: string | null
  signedUpAt: string
  status: string
  note: string | null
  submittedAt: string | null
  vehicle: string | null
  plate: string | null
  ghanaCard: string | null // GHA-123456789-0, typed by the driver
  docs: { type: string; label: string; url: string | null }[]
}

// A private document photo (30-minute link), or a "not uploaded" tile.
export function DocPhoto({ url, label }: { url: string | null; label: string }) {
  return (
    <figure className="w-40 shrink-0">
      <figcaption className="mb-1 text-xs font-medium text-ink-3">{label}</figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-control ring-1 ring-line hover:ring-action-deep">
          <Image src={url} alt={label} width={320} height={240} unoptimized className="aspect-[4/3] w-full object-cover" />
        </a>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-control bg-canvas text-xs text-ink-3 ring-1 ring-line">
          <span className="flex flex-col items-center gap-1">
            <ImageOff aria-hidden className="size-4" /> Not uploaded
          </span>
        </div>
      )}
    </figure>
  )
}

export default function DriverApprovalsClient({ waiting, notSent, rejected }: { waiting: ApplicantRow[]; notSent: ApplicantRow[]; rejected: ApplicantRow[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/drivers/${id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[id] ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg((m) => ({ ...m, [id]: res.ok ? { ok: true, text: decision === 'approve' ? 'Approved.' : 'Sent back to the driver.' } : { ok: false, text: data.error || 'Could not save' } }))
      if (res.ok) router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  function card(r: ApplicantRow, actions: boolean) {
    return (
      <li key={r.id} className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">{r.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-medium text-action-deep hover:underline">
                <Phone aria-hidden className="size-3.5" /> {r.phone}
              </a>
              {r.email && <span>{r.email}</span>}
            </p>
            <p className="mt-0.5 text-sm text-ink-3">
              {r.vehicle ?? 'No vehicle chosen'} · signed up {dateLabel(r.signedUpAt)}
              {r.submittedAt && ` · sent ${dateTimeLabel(r.submittedAt)}`}
            </p>
          </div>
          {r.status === 'REJECTED' && <Chip tone="danger">Sent back</Chip>}
        </div>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-3">Ghana Card</dt>
          <dd className={r.ghanaCard ? 'font-medium tabular-nums' : 'text-danger'}>{r.ghanaCard ?? 'Not entered'}</dd>
          <dt className="text-ink-3">Number plate</dt>
          <dd className={r.plate ? 'font-medium' : 'text-danger'}>{r.plate ?? 'Not entered'}</dd>
        </dl>
        {r.note && <p className="mt-3 rounded-control bg-canvas p-3 text-sm text-ink">Last note: {r.note}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          {r.docs.map((d) => (
            <DocPhoto key={d.type} url={d.url} label={d.label} />
          ))}
        </div>

        {actions && (
          <div className="mt-5 border-t border-line pt-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-2">Note to the driver (required to send back)</span>
              <input
                value={notes[r.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                className={`${FIELD} mt-1.5`}
                placeholder="e.g. Ghana Card number doesn't match your name"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button type="button" onClick={() => decide(r.id, 'approve')} disabled={busy === r.id} className={BUTTON_PRIMARY}>
                Approve
              </button>
              <button type="button" onClick={() => decide(r.id, 'reject')} disabled={busy === r.id} className={BUTTON_DANGER}>
                Send back
              </button>
            </div>
          </div>
        )}
        <Result msg={msg[r.id]} />
      </li>
    )
  }

  return (
    <div className="grid gap-10">
      <section aria-labelledby="h-wait">
        <SectionTitle id="h-wait" count={waiting.length} hint="Check the Ghana Card number belongs to this driver (name and photo), the plate matches the vehicle, and the vehicle looks roadworthy.">
          New drivers waiting for review
        </SectionTitle>
        {waiting.length === 0 && <AllClear>No drivers waiting.</AllClear>}
        <ul className="grid gap-3 empty:hidden xl:grid-cols-2">{waiting.map((r) => card(r, true))}</ul>
      </section>

      <section aria-labelledby="h-back">
        <SectionTitle id="h-back" count={rejected.length} hint="You can still approve them if they've fixed it by phone.">
          Sent back, waiting for the driver
        </SectionTitle>
        {rejected.length === 0 && <AllClear>None.</AllClear>}
        <ul className="grid gap-3 empty:hidden xl:grid-cols-2">{rejected.map((r) => card(r, true))}</ul>
      </section>

      <section aria-labelledby="h-notsent">
        <SectionTitle id="h-notsent" count={notSent.length} hint="Signed up, but haven't sent their documents yet.">
          Not sent yet
        </SectionTitle>
        {notSent.length === 0 && <AllClear>None.</AllClear>}
        <ul className="grid gap-3 empty:hidden xl:grid-cols-2">{notSent.map((r) => card(r, false))}</ul>
      </section>
    </div>
  )
}
