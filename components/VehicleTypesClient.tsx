'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import VehicleImageUpload from './VehicleImageUpload'

interface VehicleType {
  id: string
  name: string
  capacityLitres: number
  defaultRadiusKm: number
  maxRadiusKm: number
  imagePath: string | null
  active: boolean
  _count: { drivers: number }
}

interface FormValues {
  name: string
  capacityLitres: string
  defaultRadiusKm: string
  maxRadiusKm: string
  active: boolean
}

const labelStyle = { fontSize: 12, color: '#666' } as const

function toForm(v?: VehicleType): FormValues {
  return {
    name: v?.name ?? '',
    capacityLitres: v ? String(v.capacityLitres) : '',
    defaultRadiusKm: v ? String(v.defaultRadiusKm) : '3',
    maxRadiusKm: v ? String(v.maxRadiusKm) : '6',
    active: v?.active ?? true,
  }
}

function VehicleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues
  submitLabel: string
  onSubmit: (values: FormValues) => Promise<string | null>
  onCancel?: () => void
}) {
  const [values, setValues] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key: keyof FormValues, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }))

  async function submit() {
    setError('')
    setSaving(true)
    const problem = await onSubmit(values)
    setSaving(false)
    if (problem) setError(problem)
  }

  return (
    <div>
      <label style={labelStyle}>Name</label>
      <input value={values.name} onChange={(e) => set('name', e.target.value)} className="input-field" placeholder="e.g. Pickup truck" />

      <label style={labelStyle}>Capacity (litres)</label>
      <input type="number" min="50" value={values.capacityLitres} onChange={(e) => set('capacityLitres', e.target.value)} className="input-field" />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Default radius (km)</label>
          <input type="number" step="0.5" min="0.5" value={values.defaultRadiusKm} onChange={(e) => set('defaultRadiusKm', e.target.value)} className="input-field" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Maximum radius (km)</label>
          <input type="number" step="0.5" min="0.5" value={values.maxRadiusKm} onChange={(e) => set('maxRadiusKm', e.target.value)} className="input-field" />
        </div>
      </div>

      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input type="checkbox" checked={values.active} onChange={(e) => set('active', e.target.checked)} />
        Available for drivers to choose
      </label>

      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={saving} className="btn-accent" style={{ flex: 1 }}>
          {saving ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '0 16px', fontSize: 14 }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default function VehicleTypesClient({
  vehicleTypes,
  largestBin,
  canEdit,
}: {
  vehicleTypes: VehicleType[]
  largestBin: { label: string; litres: number } | null
  canEdit: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const router = useRouter()

  async function save(url: string, method: 'POST' | 'PATCH', values: FormValues): Promise<string | null> {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return data.error || 'Could not save'
      setNotice(
        data.driversAdjusted
          ? `Saved. ${data.driversAdjusted} driver(s) had a radius above the new maximum and were brought down to it.`
          : 'Saved.'
      )
      setEditingId(null)
      setAdding(false)
      router.refresh()
      return null
    } catch {
      return 'Could not reach Trashit. Please try again.'
    }
  }

  return (
    <div>
      {notice && <p style={{ color: '#2F7A4D', fontSize: 13, marginBottom: 12 }}>{notice}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {vehicleTypes.map((v) => (
          <div key={v.id} className="panel" style={{ opacity: v.active ? 1 : 0.55 }}>
            <div
              style={{
                background: '#F7F5F1',
                borderRadius: 4,
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              {v.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.imagePath} alt={v.name} style={{ maxHeight: 110, maxWidth: '100%' }} />
              ) : (
                <span style={{ fontSize: 12, color: '#999' }}>No picture yet</span>
              )}
            </div>
            {canEdit && <VehicleImageUpload vehicleId={v.id} imagePath={v.imagePath} />}

            {editingId === v.id ? (
              <VehicleForm
                initial={toForm(v)}
                submitLabel="Save changes"
                onSubmit={(values) => save(`/api/admin/vehicle-types/${v.id}`, 'PATCH', values)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontWeight: 600 }}>{v.name}</p>
                  {!v.active && <span style={{ fontSize: 11, color: '#B3261E' }}>HIDDEN</span>}
                </div>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  Capacity: <strong>{v.capacityLitres.toLocaleString()} L</strong>
                  {largestBin && (
                    <span style={{ color: '#666' }}>
                      {' '}
                      (about {Math.floor(v.capacityLitres / largestBin.litres)} {largestBin.label.toLowerCase()}s)
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 13 }}>
                  Radius: {v.defaultRadiusKm} km by default, up to {v.maxRadiusKm} km
                </p>
                <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{v._count.drivers} driver(s) use this vehicle</p>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingId(v.id)
                      setNotice('')
                    }}
                    style={{ marginTop: 8, background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 10px', fontSize: 12 }}
                  >
                    Edit
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div style={{ marginTop: 20 }}>
          {adding ? (
            <div className="panel" style={{ maxWidth: 420 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Add a vehicle type</h2>
              <VehicleForm
                initial={toForm()}
                submitLabel="Add vehicle"
                onSubmit={(values) => save('/api/admin/vehicle-types', 'POST', values)}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setAdding(true)
                setNotice('')
              }}
              className="btn-primary"
            >
              + Add a vehicle type
            </button>
          )}
        </div>
      )}

      {!canEdit && (
        <p style={{ fontSize: 12, color: '#999', marginTop: 16 }}>Only a Super Admin or Ops Manager can change vehicles.</p>
      )}
    </div>
  )
}
