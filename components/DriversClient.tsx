'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, IdCard, MapPin, Phone } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { AllClear, Chip, Result, SELECT } from '@/components/ops/kit'
import { TZ } from '@/lib/format'
import { useNow } from '@/lib/use-now'

interface DriverRow {
  id: string
  name: string
  phone: string
  active: boolean
  online: boolean
  onlineSince: string | null
  overrideUntil: string | null
  vehicle: string | null
  capacityLitres: number | null
  radiusKm: number | null
  zone: string | null
  hasHomeBase: boolean
  lastLocationAt: string | null
  ghanaCard: string | null // partly hidden; only for staff who approve drivers
  cardPhotoUrl: string | null // an old Ghana Card photo, to copy the number from (30-minute link)
}

// Enter (or, with a reason, correct) a driver's Ghana Card number.
function GhanaCard({ d }: { d: DriverRow }) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/drivers/${d.id}/ghana-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not save' })
        return
      }
      setOpen(false)
      setNumber('')
      setReason('')
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1.5 text-sm">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`inline-flex items-center gap-1.5 ${d.ghanaCard ? 'text-ink-2' : 'font-medium text-danger'}`}>
          <IdCard aria-hidden className="size-4" /> {d.ghanaCard ? `Ghana Card ${d.ghanaCard}` : 'No Ghana Card number'}
        </span>
        {d.cardPhotoUrl && (
          <a href={d.cardPhotoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ops-deep hover:underline">
            Open old card photo
          </a>
        )}
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="min-h-9 font-semibold text-ops-deep hover:underline">
            {d.ghanaCard ? 'Correct' : 'Add number'}
          </button>
        )}
      </p>
      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label>
            <span className="sr-only">Ghana Card number for {d.name}</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              placeholder="GHA-123456789-0"
              autoCapitalize="characters"
              autoComplete="off"
              className={`${FIELD} w-52 tabular-nums`}
            />
          </label>
          {d.ghanaCard && (
            <label className="min-w-0 flex-1 basis-48">
              <span className="sr-only">Why you are correcting it</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it's being corrected" className={FIELD} />
            </label>
          )}
          <button type="button" onClick={save} disabled={busy || number.trim().length < 10 || (!!d.ghanaCard && reason.trim().length < 3)} className={BUTTON_PRIMARY}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className={BUTTON_QUIET}>
            Cancel
          </button>
        </div>
      )}
      <Result msg={msg} />
    </div>
  )
}

function ago(iso: string, now: number): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)} h ${mins % 60} min ago`
}

// Ghana time, so the server and the browser agree.
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function DriversClient({ drivers, canEditId = false }: { drivers: DriverRow[]; canEditId?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [hours, setHours] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const router = useRouter()
  const now = useNow(60_000) // null until the browser has its clock

  async function setOverride(driverId: string, h: number) {
    setBusy(driverId)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}/online-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: h }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error || 'Could not update the driver')
        return
      }
      router.refresh()
    } catch {
      setMessage('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (drivers.length === 0) return <AllClear>No drivers yet.</AllClear>

  return (
    <div>
      <Result msg={message ? { ok: false, text: message } : null} />
      <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {drivers.map((d) => (
          <li key={d.id} className={`flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5 ${d.active ? '' : 'bg-canvas/60'}`}>
            <div className="min-w-0 flex-1 basis-72">
              <p className="flex flex-wrap items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${d.online ? 'bg-driver' : 'bg-line-strong'}`} aria-hidden />
                <span className="font-semibold">{d.name}</span>
                <span className="sr-only">{d.online ? 'online' : 'offline'}</span>
                {!d.active && <Chip tone="danger">Paused</Chip>}
                {d.online && <Chip tone="driver">Online</Chip>}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1 font-medium text-ops-deep hover:underline">
                  <Phone aria-hidden className="size-3.5" /> {d.phone}
                </a>
                <span>
                  {d.vehicle ?? 'No vehicle set'}
                  {d.capacityLitres != null && ` (${d.capacityLitres.toLocaleString()} L)`}
                  {d.radiusKm != null && ` · ${d.radiusKm} km radius`}
                  {d.zone && ` · ${d.zone}`}
                </span>
                {!d.hasHomeBase && <span className="text-danger">No home base yet</span>}
              </p>
              {canEditId && <GhanaCard d={d} />}
              {d.online && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
                  <MapPin aria-hidden className="size-3.5" />
                  {d.onlineSince ? `Online since ${clock(d.onlineSince)}` : 'Online'}
                  {' · '}
                  {d.lastLocationAt ? `location ${now == null ? 'received' : ago(d.lastLocationAt, now)}` : 'waiting for location'}
                </p>
              )}
              {d.overrideUntil && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-driver-deep">
                  <Clock aria-hidden className="size-3.5" /> Extra hours allowed until {clock(d.overrideUntil)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {d.overrideUntil ? (
                <button type="button" onClick={() => setOverride(d.id, 0)} disabled={busy === d.id} className={BUTTON_QUIET}>
                  Remove extra hours
                </button>
              ) : (
                <>
                  <select
                    value={hours[d.id] ?? '2'}
                    onChange={(e) => setHours((h) => ({ ...h, [d.id]: e.target.value }))}
                    className={SELECT}
                    aria-label={`Extra hours for ${d.name}`}
                  >
                    {[1, 2, 4, 8, 12].map((h) => (
                      <option key={h} value={h}>
                        {h} h
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setOverride(d.id, Number(hours[d.id] ?? '2'))} disabled={busy === d.id || !d.active} className={BUTTON_QUIET}>
                    Allow extra hours
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
