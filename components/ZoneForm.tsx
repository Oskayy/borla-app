'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ZoneMap from './ZoneMap'

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

  return (
    <div>
      <div className="panel">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginBottom: 12 }}>
          {isEditing ? `Edit "${editingZone!.name}"` : 'Add New Zone'}
        </h2>

        <label style={{ fontSize: 12, color: '#666' }}>Zone name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Tema Community Belt" />

        <label style={{ fontSize: 12, color: '#666' }}>City</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className="input-field" placeholder="e.g. Tema" />

        <label style={{ fontSize: 12, color: '#666' }}>Towns / communities covered (comma-separated)</label>
        <input value={coveredAreas} onChange={(e) => setCoveredAreas(e.target.value)} className="input-field" placeholder="e.g. Tema Community 1, Tema Community 4" />

        <label style={{ fontSize: 12, color: '#666' }}>Center latitude</label>
        <input type="number" step="any" value={centerLat} onChange={(e) => setCenterLat(e.target.value)} className="input-field" placeholder="e.g. 5.6698" />

        <label style={{ fontSize: 12, color: '#666' }}>Center longitude</label>
        <input type="number" step="any" value={centerLng} onChange={(e) => setCenterLng(e.target.value)} className="input-field" placeholder="e.g. -0.0166" />

        <label style={{ fontSize: 12, color: '#666' }}>Radius (km)</label>
        <input type="number" step="0.1" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} className="input-field" placeholder="e.g. 3" />

        {isEditing && (
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        )}

        {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} disabled={loading} className="btn-accent" style={{ flex: 1 }}>
            {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Zone'}
          </button>
          {isEditing && (
            <>
              <button onClick={handleDelete} disabled={loading} style={{ background: 'none', border: '1px solid #B3261E', color: '#B3261E', borderRadius: 4, padding: '0 16px', fontSize: 14 }}>
                Delete
              </button>
              <button onClick={onDoneEditing} disabled={loading} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '0 16px', fontSize: 14 }}>
                Cancel
              </button>
            </>
          )}
        </div>

        {!isEditing && (
          <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
            To find center coordinates: open Google Maps, right-click the middle of the area you want to cover, and click the coordinates that appear to copy them.
          </p>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          {preview ? 'Live preview — this circle updates as you edit the fields above.' : 'Enter coordinates above to see a preview.'}
        </p>
        <ZoneMap zones={isEditing ? otherZones.filter((z) => z.id !== editingZone!.id) : otherZones} preview={preview} />
      </div>
    </div>
  )
}