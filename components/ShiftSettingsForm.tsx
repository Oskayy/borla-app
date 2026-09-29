'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ShiftTimes {
  shiftStart: string
  shiftEnd: string
  planningSnapshot: string
  hardCutoff: string
  maxTripsPerNight: string
  acceptMinutes: string
  autoDispatch: boolean
}

const FIELDS: { key: Exclude<keyof ShiftTimes, 'maxTripsPerNight' | 'acceptMinutes' | 'autoDispatch'>; label: string; hint: string }[] = [
  { key: 'shiftStart', label: 'Shift starts', hint: 'When drivers start collecting (evening).' },
  { key: 'shiftEnd', label: 'Shift ends', hint: 'When collection stops the next morning.' },
  { key: 'planningSnapshot', label: 'Planning snapshot', hint: "Orders paid before this are planned into tonight's routes." },
  { key: 'hardCutoff', label: 'Hard cutoff', hint: "Last time an order can still join tonight's shift (00:00 = midnight)." },
]

export default function ShiftSettingsForm({ initial }: { initial: ShiftTimes }) {
  const [values, setValues] = useState<ShiftTimes>(initial)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit() {
    setError('')
    setSaved(false)
    setLoading(true)
    const res = await fetch('/api/admin/operating-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Could not save shift hours')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="panel">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label style={{ fontSize: 12, color: '#666' }}>{f.label}</label>
          <input
            type="time"
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="input-field"
          />
          <p style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 12 }}>{f.hint}</p>
        </div>
      ))}

      <label style={{ fontSize: 12, color: '#666' }}>Trips per night</label>
      <input
        type="number"
        min={1}
        max={8}
        value={values.maxTripsPerNight}
        onChange={(e) => setValues((v) => ({ ...v, maxTripsPerNight: e.target.value }))}
        className="input-field"
      />
      <p style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 12 }}>
        How many loads one driver can collect and unload in a shift. The planner gives each driver up to capacity × 90% × this.
      </p>

      <label style={{ fontSize: 12, color: '#666' }}>Minutes a driver has to accept a stop</label>
      <input
        type="number"
        min={5}
        max={120}
        value={values.acceptMinutes}
        onChange={(e) => setValues((v) => ({ ...v, acceptMinutes: e.target.value }))}
        className="input-field"
      />
      <p style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 12 }}>
        Counted from when the stop is sent, or from the start of the shift for stops planned in advance. Stops not accepted
        in time go to the next best driver automatically.
      </p>

      <label style={{ fontSize: 14, display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={values.autoDispatch}
          onChange={(e) => setValues((v) => ({ ...v, autoDispatch: e.target.checked }))}
          style={{ marginTop: 3 }}
        />
        <span>Assign waiting orders automatically once the shift starts</span>
      </label>
      <p style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>
        At the planning snapshot ops are told tonight&apos;s plan is ready to approve. With this on, anything not approved by
        the shift start, and every late order after that, goes to the best online driver within a couple of minutes. Turn
        it off to assign everything by hand.
      </p>

      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {saved && <p style={{ color: '#2F7A4D', fontSize: 13, marginBottom: 8 }}>Saved. New bookings use these hours now.</p>}

      <button onClick={submit} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Saving...' : 'Save shift hours'}
      </button>
      <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Changes are logged and apply to new payments only.</p>
    </div>
  )
}
