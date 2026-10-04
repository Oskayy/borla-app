'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteMap, { type MapZone } from './SiteMap'

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
  notes: string
  zoneId: string
  active: boolean
}

const WASTE_LABELS: Record<string, string> = { general: 'General', recyclable: 'Recyclable', hazardous: 'Hazardous' }
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  OPEN: { bg: '#E4F1E9', fg: '#2F7A4D', label: 'Open' },
  FULL: { bg: '#FFF1DC', fg: '#9A6415', label: 'Full / queueing' },
  CLOSED: { bg: '#F9E3E1', fg: '#B3261E', label: 'Closed' },
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

  const labelStyle = { fontSize: 12, color: '#666' } as const
  const smallButton = {
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
  } as const

  return (
    <div>
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
      <p style={{ fontSize: 12, color: '#999', margin: '6px 0 16px' }}>
        Green = open, amber = full or queueing, red = closed, grey = inactive. The shaded circle around each site is its
        geofence. {editing ? 'Click the map to place this site.' : canEdit ? 'Click a site to edit it.' : ''}
      </p>

      {notice && <p style={{ color: '#2F7A4D', fontSize: 13, marginBottom: 12 }}>{notice}</p>}

      {editing && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>{editing === 'new' ? 'Add a disposal site' : `Edit "${form.name}"`}</h2>

          <p style={{ fontSize: 13, marginBottom: 12, color: pin ? '#2F7A4D' : '#B3261E' }}>
            {pin ? `Position: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} (click the map to move it)` : 'Click the map to place the site.'}
          </p>

          <label style={labelStyle}>Site name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input-field" placeholder="e.g. Kpone Engineered Landfill" />

          <label style={labelStyle}>Address or directions (optional)</label>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} className="input-field" placeholder="e.g. Off the Tema–Aflao road, after the Kpone junction" />

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Geofence radius (metres)</label>
              <input type="number" min="30" max="1000" step="10" value={form.geofenceRadiusM} onChange={(e) => set('geofenceRadiusM', e.target.value)} className="input-field" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Average unload time (minutes)</label>
              <input type="number" min="1" max="240" value={form.avgUnloadMinutes} onChange={(e) => set('avgUnloadMinutes', e.target.value)} className="input-field" />
            </div>
          </div>

          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={form.open24Hours} onChange={(e) => set('open24Hours', e.target.checked)} />
            Open 24 hours
          </label>
          {!form.open24Hours && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Opens</label>
                <input type="time" value={form.opensAt} onChange={(e) => set('opensAt', e.target.value)} className="input-field" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Closes (can be after midnight)</label>
                <input type="time" value={form.closesAt} onChange={(e) => set('closesAt', e.target.value)} className="input-field" />
              </div>
            </div>
          )}

          <p style={{ ...labelStyle, marginBottom: 6 }}>Accepts</p>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {Object.entries(WASTE_LABELS).map(([type, label]) => (
              <label key={type} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.acceptedWaste.includes(type)} onChange={() => toggleWaste(type)} />
                {label}
              </label>
            ))}
          </div>

          <label style={labelStyle}>Main zone served (optional)</label>
          <select value={form.zoneId} onChange={(e) => set('zoneId', e.target.value)} className="input-field">
            <option value="">Any zone</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>

          <label style={labelStyle}>Notes (optional)</label>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input-field" placeholder="e.g. Gate 2 at night; ask for the weighbridge ticket" />

          {editing !== 'new' && (
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
              Active (untick to stop using this site; its history is kept)
            </label>
          )}

          {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving} className="btn-accent" style={{ flex: 1 }}>
              {saving ? 'Saving...' : editing === 'new' ? 'Add site' : 'Save changes'}
            </button>
            <button onClick={cancel} disabled={saving} style={{ ...smallButton, fontSize: 14, padding: '0 16px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && canEdit && (
        <button onClick={startAdd} className="btn-primary" style={{ marginBottom: 16 }}>
          + Add a disposal site
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sites.length === 0 && (
          <div className="panel">
            <p>No disposal sites yet.</p>
          </div>
        )}
        {sites.map((s) => {
          const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.OPEN
          return (
            <div key={s.id} className="panel" style={{ opacity: s.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>
                    {s.name}{' '}
                    {s.active ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#B3261E' }}>INACTIVE</span>
                    )}
                  </p>
                  <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                    {s.hoursLabel} · accepts {s.acceptedWaste.map((w) => WASTE_LABELS[w] ?? w).join(', ').toLowerCase()} · geofence{' '}
                    {s.geofenceRadiusM} m · unload ~{s.avgUnloadMinutes} min
                  </p>
                  {s.lat == null && <p style={{ fontSize: 12, color: '#B3261E', marginTop: 2 }}>Not on the map yet</p>}
                  {!s.coversShift && s.active && (
                    <p style={{ fontSize: 12, color: '#B3261E', marginTop: 2 }}>
                      ⚠ Closes during the night shift. The planner will only send drivers here while it is open.
                    </p>
                  )}
                  {s.notes && <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{s.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {canSetStatus &&
                    s.active &&
                    Object.keys(STATUS_STYLE)
                      .filter((code) => code !== s.status)
                      .map((code) => (
                        <button key={code} onClick={() => setStatus(s.id, code)} disabled={statusBusy === s.id} style={smallButton}>
                          Mark {STATUS_STYLE[code].label.toLowerCase()}
                        </button>
                      ))}
                  {canEdit && !editing && (
                    <button onClick={() => startEdit(s)} style={smallButton}>
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
