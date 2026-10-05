'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import VehicleImageUpload from './VehicleImageUpload'
import { Pencil, Plus, Truck } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { CHECK, Chip, PANEL, Result } from '@/components/ops/kit'

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

  const label = 'text-sm font-medium text-ink-2'
  return (
    <div className="grid gap-4">
      <label className="block">
        <span className={label}>Name</span>
        <input value={values.name} onChange={(e) => set('name', e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Pickup truck" />
      </label>
      <label className="block">
        <span className={label}>Capacity (litres)</span>
        <input type="number" min="50" value={values.capacityLitres} onChange={(e) => set('capacityLitres', e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Default radius (km)</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={values.defaultRadiusKm}
            onChange={(e) => set('defaultRadiusKm', e.target.value)}
            className={`${FIELD} mt-1.5 tabular-nums`}
          />
        </label>
        <label className="block">
          <span className={label}>Maximum radius (km)</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={values.maxRadiusKm}
            onChange={(e) => set('maxRadiusKm', e.target.value)}
            className={`${FIELD} mt-1.5 tabular-nums`}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-[15px] font-medium">
        <input type="checkbox" checked={values.active} onChange={(e) => set('active', e.target.checked)} className={CHECK} />
        Drivers can choose it
      </label>

      <Result msg={error ? { ok: false, text: error } : null} />
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={submit} disabled={saving} className={BUTTON_PRIMARY}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className={BUTTON_QUIET}>
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
          ? `Saved. ${data.driversAdjusted} ${data.driversAdjusted === 1 ? 'driver had a radius' : 'drivers had radii'} above the new maximum and ${
              data.driversAdjusted === 1 ? 'was' : 'were'
            } brought down to it.`
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
    <div className="grid gap-6">
      <Result msg={notice ? { ok: true, text: notice } : null} />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicleTypes.map((v) => (
          <li key={v.id} className={`${PANEL} ${v.active ? '' : 'opacity-70'}`}>
            <div className="grid h-32 place-items-center rounded-control bg-canvas">
              {v.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.imagePath} alt={v.name} className="max-h-28 max-w-full" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-sm text-ink-3">
                  <Truck aria-hidden className="size-6" /> No picture yet
                </span>
              )}
            </div>
            {canEdit && <VehicleImageUpload vehicleId={v.id} imagePath={v.imagePath} />}

            <div className="mt-3">
              {editingId === v.id ? (
                <VehicleForm
                  initial={toForm(v)}
                  submitLabel="Save changes"
                  onSubmit={(values) => save(`/api/admin/vehicle-types/${v.id}`, 'PATCH', values)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold tracking-tight">{v.name}</span>
                    {!v.active && <Chip tone="danger">Hidden from drivers</Chip>}
                  </p>
                  <p className="mt-1 text-[15px]">
                    <span className="font-semibold tabular-nums">{v.capacityLitres.toLocaleString()} L</span>
                    {largestBin && (
                      <span className="text-ink-3">
                        {' '}
                        · about {Math.floor(v.capacityLitres / largestBin.litres)} {largestBin.label.toLowerCase()}s
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-2">
                    Radius {v.defaultRadiusKm} km by default, up to {v.maxRadiusKm} km
                  </p>
                  <p className="mt-1 text-sm text-ink-3">
                    {v._count.drivers} {v._count.drivers === 1 ? 'driver uses' : 'drivers use'} it
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(v.id)
                        setNotice('')
                      }}
                      className={`${BUTTON_QUIET} mt-3`}
                    >
                      <Pencil aria-hidden className="size-4" /> Edit
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canEdit &&
        (adding ? (
          <section aria-labelledby="h-add-vehicle" className={`${PANEL} max-w-md`}>
            <h2 id="h-add-vehicle" className="mb-4 text-base font-semibold tracking-tight">
              New vehicle type
            </h2>
            <VehicleForm
              initial={toForm()}
              submitLabel="Add vehicle"
              onSubmit={(values) => save('/api/admin/vehicle-types', 'POST', values)}
              onCancel={() => setAdding(false)}
            />
          </section>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setAdding(true)
                setNotice('')
              }}
              className={BUTTON_PRIMARY}
            >
              <Plus aria-hidden className="size-4" /> Add a vehicle type
            </button>
          </div>
        ))}

      {!canEdit && <p className="text-sm text-ink-3">Only a Super Admin or Ops Manager can change vehicles.</p>}
    </div>
  )
}
