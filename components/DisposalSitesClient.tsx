'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteMap, { type MapZone } from './SiteMap'
import { AlertTriangle, MapPin, Pencil, Plus } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { AllClear, CHECK, Chip, PANEL, Result, SectionTitle, type Tone } from '@/components/ops/kit'

export interface SiteRow {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  geofenceRadiusM: number
  open24Hours: boolean
  opensAtMinutes: number | null
  closesAtMinutes: number | null
  acceptedWaste: string[]
  status: string
  avgUnloadMinutes: number
  tippingFee: number
  notes: string | null
  zoneId: string | null
  active: boolean
  hoursLabel: string
  coversShift: boolean
}

interface FormState {
  name: string
  address: string
  geofenceRadiusM: string
  open24Hours: boolean
  opensAt: string
  closesAt: string
  acceptedWaste: string[]
  avgUnloadMinutes: string
  tippingFee: string
  notes: string
  zoneId: string
  active: boolean
}

const WASTE_LABELS: Record<string, string> = { general: 'General', recyclable: 'Recyclable', hazardous: 'Hazardous' }
const STATUS: Record<string, { tone: Tone; label: string }> = {
  OPEN: { tone: 'ops', label: 'Open' },
  FULL: { tone: 'neutral', label: 'Full or queueing' },
  CLOSED: { tone: 'danger', label: 'Closed' },
}

const toClock = (m: number | null, fallback: string) =>
  m == null ? fallback : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function toForm(s?: SiteRow): FormState {
  return {
    name: s?.name ?? '',
    address: s?.address ?? '',
    geofenceRadiusM: String(s?.geofenceRadiusM ?? 150),
    open24Hours: s?.open24Hours ?? true,
    opensAt: toClock(s?.opensAtMinutes ?? null, '19:00'),
    closesAt: toClock(s?.closesAtMinutes ?? null, '07:00'),
    acceptedWaste: s?.acceptedWaste ?? ['general', 'recyclable'],
    avgUnloadMinutes: String(s?.avgUnloadMinutes ?? 15),
    tippingFee: String(s?.tippingFee ?? 0),
    notes: s?.notes ?? '',
    zoneId: s?.zoneId ?? '',
    active: s?.active ?? true,
  }
}

export default function DisposalSitesClient({
  sites,
  zones,
  canEdit,
  canSetStatus,
}: {
  sites: SiteRow[]
  zones: MapZone[]
  canEdit: boolean
  canSetStatus: boolean
}) {
  // null = not editing, 'new' = adding a site, otherwise the id of the site being edited
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(toForm())
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const router = useRouter()

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  function startEdit(site: SiteRow) {
    if (!canEdit) return
    setEditing(site.id)
    setForm(toForm(site))
    setPin(site.lat != null && site.lng != null ? { lat: site.lat, lng: site.lng } : null)
    setError('')
    setNotice('')
  }

  function startAdd() {
    setEditing('new')
    setForm(toForm())
    setPin(null)
    setError('')
    setNotice('')
  }

  function cancel() {
    setEditing(null)
    setPin(null)
    setError('')
  }

  function toggleWaste(type: string) {
    set('acceptedWaste', form.acceptedWaste.includes(type) ? form.acceptedWaste.filter((w) => w !== type) : [...form.acceptedWaste, type])
  }

  async function save() {
    if (!pin) {
      setError('Click the map to place the site')
      return
    }
    setError('')
    setSaving(true)
    try {
      const url = editing === 'new' ? '/api/admin/disposal-sites' : `/api/admin/disposal-sites/${editing}`
      const res = await fetch(url, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lat: pin.lat, lng: pin.lng }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not save the site')
        return
      }
      setNotice(editing === 'new' ? 'Site added.' : 'Site saved.')
      setEditing(null)
      setPin(null)
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(siteId: string, status: string) {
    setStatusBusy(siteId)
    setNotice('')
    try {
      const res = await fetch(`/api/admin/disposal-sites/${siteId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setNotice(data.error || 'Could not change the status')
      router.refresh()
    } catch {
      setNotice('Could not reach Trashit. Please try again.')
    } finally {
      setStatusBusy(null)
    }
  }

  const label = 'text-sm font-medium text-ink-2'

  return (
    <div className="grid gap-6">
      <div>
        <div className="overflow-hidden rounded-card ring-1 ring-line">
          <SiteMap
            zones={zones}
            sites={sites}
            editPin={editing ? pin : null}
            editRadiusM={Number(form.geofenceRadiusM) || 150}
            onPinChange={editing ? setPin : undefined}
            onSiteClick={(id) => {
              const site = sites.find((s) => s.id === id)
              if (site && !editing) startEdit(site)
            }}
            focusKey={editing}
          />
        </div>
        <p className="mt-2 text-sm text-ink-3">
          Green = open, amber = full or queueing, red = closed, grey = inactive. The shaded circle around each site is its geofence.{' '}
          {editing ? 'Click the map to place this site.' : canEdit ? 'Click a site to edit it.' : ''}
        </p>
      </div>

      <Result msg={notice ? { ok: !/could not|reach/i.test(notice), text: notice } : null} />

      {editing && (
        <section aria-labelledby="h-site-form" className={PANEL}>
          <h2 id="h-site-form" className="text-base font-semibold tracking-tight">
            {editing === 'new' ? 'New disposal site' : `Edit ${form.name}`}
          </h2>
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${pin ? 'text-ink-2' : 'font-medium text-danger'}`}>
            <MapPin aria-hidden className="size-4" />
            {pin ? `Position ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} (click the map to move it)` : 'Click the map to place the site.'}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Site name</span>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Kpone Engineered Landfill" />
            </label>
            <label className="block">
              <span className={label}>Address or directions (optional)</span>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Off the Tema–Aflao road" />
            </label>
            <label className="block">
              <span className={label}>Geofence radius (metres)</span>
              <input
                type="number"
                min="30"
                max="1000"
                step="10"
                value={form.geofenceRadiusM}
                onChange={(e) => set('geofenceRadiusM', e.target.value)}
                className={`${FIELD} mt-1.5 tabular-nums`}
              />
            </label>
            <label className="block">
              <span className={label}>Average unload time (minutes)</span>
              <input
                type="number"
                min="1"
                max="240"
                value={form.avgUnloadMinutes}
                onChange={(e) => set('avgUnloadMinutes', e.target.value)}
                className={`${FIELD} mt-1.5 tabular-nums`}
              />
            </label>
            <label className="block">
              <span className={label}>Tipping fee drivers pay here (GHS)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tippingFee}
                onChange={(e) => set('tippingFee', e.target.value)}
                className={`${FIELD} mt-1.5 tabular-nums`}
              />
              <span className="mt-1 block text-xs text-ink-3">Recorded only for now; drivers aren&apos;t reimbursed yet.</span>
            </label>
          </div>

          <label className="mt-4 flex min-h-11 items-center gap-2 text-[15px] font-medium">
            <input type="checkbox" checked={form.open24Hours} onChange={(e) => set('open24Hours', e.target.checked)} className={CHECK} />
            Open 24 hours
          </label>
          {!form.open24Hours && (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Opens</span>
                <input type="time" value={form.opensAt} onChange={(e) => set('opensAt', e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} />
              </label>
              <label className="block">
                <span className={label}>Closes (can be after midnight)</span>
                <input type="time" value={form.closesAt} onChange={(e) => set('closesAt', e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} />
              </label>
            </div>
          )}

          <fieldset className="mt-4">
            <legend className={label}>Accepts</legend>
            <div className="mt-1 flex flex-wrap gap-x-5">
              {Object.entries(WASTE_LABELS).map(([type, text]) => (
                <label key={type} className="flex min-h-11 items-center gap-2 text-[15px]">
                  <input type="checkbox" checked={form.acceptedWaste.includes(type)} onChange={() => toggleWaste(type)} className={CHECK} />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Main zone served (optional)</span>
              <select value={form.zoneId} onChange={(e) => set('zoneId', e.target.value)} className={`${FIELD} mt-1.5`}>
                <option value="">Any zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Notes for drivers (optional)</span>
              <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Gate 2 at night; ask for the weighbridge ticket" />
            </label>
          </div>

          {editing !== 'new' && (
            <label className="mt-4 flex min-h-11 items-start gap-2 text-[15px]">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className={`${CHECK} mt-1`} />
              <span>
                <span className="font-medium">Active</span>
                <span className="block text-sm text-ink-3">Untick to stop using this site; its history is kept.</span>
              </span>
            </label>
          )}

          <Result msg={error ? { ok: false, text: error } : null} />
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="button" onClick={save} disabled={saving} className={BUTTON_PRIMARY}>
              {saving ? 'Saving…' : editing === 'new' ? 'Add site' : 'Save changes'}
            </button>
            <button type="button" onClick={cancel} disabled={saving} className={BUTTON_QUIET}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {!editing && canEdit && (
        <div>
          <button type="button" onClick={startAdd} className={BUTTON_PRIMARY}>
            <Plus aria-hidden className="size-4" /> Add a disposal site
          </button>
        </div>
      )}

      <section aria-labelledby="h-sites">
        <SectionTitle id="h-sites" count={sites.length}>
          Sites
        </SectionTitle>
        {sites.length === 0 ? (
          <AllClear>No disposal sites yet.</AllClear>
        ) : (
          <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {sites.map((s) => {
              const st = STATUS[s.status] ?? STATUS.OPEN
              return (
                <li key={s.id} className={`flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5 ${s.active ? '' : 'bg-canvas/60'}`}>
                  <div className="min-w-0 flex-1 basis-72">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      {s.active ? <Chip tone={st.tone}>{st.label}</Chip> : <Chip>Inactive</Chip>}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {s.hoursLabel} · accepts {s.acceptedWaste.map((w) => WASTE_LABELS[w] ?? w).join(', ').toLowerCase()} · geofence {s.geofenceRadiusM} m ·
                      unload about {s.avgUnloadMinutes} min{s.tippingFee > 0 && ` · tipping fee GHS ${s.tippingFee.toFixed(2)}`}
                    </p>
                    {s.lat == null && <p className="mt-1 text-sm font-medium text-danger">Not on the map yet</p>}
                    {!s.coversShift && s.active && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-danger">
                        <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        Closes during the night shift. The planner only sends drivers here while it&apos;s open.
                      </p>
                    )}
                    {s.notes && <p className="mt-1 text-sm text-ink-2">{s.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canSetStatus &&
                      s.active &&
                      Object.keys(STATUS)
                        .filter((code) => code !== s.status)
                        .map((code) => (
                          <button key={code} type="button" onClick={() => setStatus(s.id, code)} disabled={statusBusy === s.id} className={BUTTON_QUIET}>
                            Mark {STATUS[code].label.toLowerCase()}
                          </button>
                        ))}
                    {canEdit && !editing && (
                      <button type="button" onClick={() => startEdit(s)} className={BUTTON_QUIET}>
                        <Pencil aria-hidden className="size-4" /> Edit
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
