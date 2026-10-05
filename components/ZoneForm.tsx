'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ZoneMap from './ZoneMap'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { CHECK, PANEL, Result } from '@/components/ops/kit'

interface ExistingZone {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  coveredAreas: string[]
  active: boolean
}

export default function ZoneForm({
  editingZone,
  onDoneEditing,
  otherZones,
}: {
  editingZone?: ExistingZone | null
  onDoneEditing?: () => void
  otherZones: ExistingZone[]
}) {
  const [name, setName] = useState(editingZone?.name ?? '')
  const [city, setCity] = useState(editingZone?.city ?? '')
  const [centerLat, setCenterLat] = useState(editingZone?.centerLat?.toString() ?? '')
  const [centerLng, setCenterLng] = useState(editingZone?.centerLng?.toString() ?? '')
  const [radiusKm, setRadiusKm] = useState(editingZone?.radiusKm?.toString() ?? '3')
  const [coveredAreas, setCoveredAreas] = useState(editingZone?.coveredAreas?.join(', ') ?? '')
  const [active, setActive] = useState(editingZone?.active ?? true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const isEditing = !!editingZone

  const previewValid = centerLat !== '' && centerLng !== '' && !isNaN(Number(centerLat)) && !isNaN(Number(centerLng))
  const preview = previewValid
    ? { centerLat: Number(centerLat), centerLng: Number(centerLng), radiusKm: Number(radiusKm) || 3, name: name || 'New Zone' }
    : null

  function resetForm() {
    setName('')
    setCity('')
    setCenterLat('')
    setCenterLng('')
    setRadiusKm('3')
    setCoveredAreas('')
    setActive(true)
  }

  async function submit() {
    setError('')
    setLoading(true)

    const url = isEditing ? `/api/admin/zones/${editingZone!.id}` : '/api/admin/zones'
    const method = isEditing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city, centerLat, centerLng, radiusKm, coveredAreas, active }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to save zone')
      return
    }

    if (isEditing) {
      onDoneEditing?.()
    } else {
      resetForm()
    }
    router.refresh()
  }

  async function handleDelete() {
    if (!editingZone) return
    if (!confirm(`Delete "${editingZone.name}"? This cannot be undone.`)) return

    setError('')
    setLoading(true)
    const res = await fetch(`/api/admin/zones/${editingZone.id}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to delete zone')
      return
    }

    onDoneEditing?.()
    router.refresh()
  }

  const label = 'text-sm font-medium text-ink-2'
  return (
    <div className="grid gap-4">
      <section aria-labelledby="h-zone-form" className={PANEL}>
        <h2 id="h-zone-form" className="text-base font-semibold tracking-tight">
          {isEditing ? `Edit ${editingZone!.name}` : 'New zone'}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Zone name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Tema Community Belt" />
          </label>
          <label className="block">
            <span className={label}>City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Tema" />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Towns and communities covered (comma-separated)</span>
            <input
              value={coveredAreas}
              onChange={(e) => setCoveredAreas(e.target.value)}
              className={`${FIELD} mt-1.5`}
              placeholder="e.g. Tema Community 1, Tema Community 4"
            />
          </label>
          <label className="block">
            <span className={label}>Centre latitude</span>
            <input type="number" step="any" value={centerLat} onChange={(e) => setCenterLat(e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} placeholder="e.g. 5.6698" />
          </label>
          <label className="block">
            <span className={label}>Centre longitude</span>
            <input type="number" step="any" value={centerLng} onChange={(e) => setCenterLng(e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} placeholder="e.g. -0.0166" />
          </label>
          <label className="block">
            <span className={label}>Radius (km)</span>
            <input type="number" step="0.1" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} placeholder="e.g. 3" />
          </label>
          {isEditing && (
            <label className="flex min-h-11 items-center gap-2 self-end text-[15px] font-medium">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className={CHECK} />
              Active (customers can book here)
            </label>
          )}
        </div>
        {!isEditing && (
          <p className="mt-3 text-sm text-ink-3">
            To find the centre: in Google Maps, right-click the middle of the area and click the coordinates to copy them.
          </p>
        )}

        <Result msg={error ? { ok: false, text: error } : null} />
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={submit} disabled={loading} className={BUTTON_PRIMARY}>
            {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Create zone'}
          </button>
          {isEditing && (
            <>
              <button type="button" onClick={onDoneEditing} disabled={loading} className={BUTTON_QUIET}>
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={loading} className={`${BUTTON_DANGER} sm:ml-auto`}>
                Delete zone
              </button>
            </>
          )}
        </div>
      </section>

      <div>
        <p className="mb-2 text-sm text-ink-3">
          {preview ? 'Live preview: the circle follows the fields above.' : 'Enter a centre above to preview the zone on the map.'}
        </p>
        <div className="overflow-hidden rounded-card ring-1 ring-line">
          <ZoneMap zones={isEditing ? otherZones.filter((z) => z.id !== editingZone!.id) : otherZones} preview={preview} />
        </div>
      </div>
    </div>
  )
}
