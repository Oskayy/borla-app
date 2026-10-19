'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { CHECK, PANEL, Result } from '@/components/ops/kit'

interface ShiftTimes {
  shiftStart: string
  shiftEnd: string
  planningSnapshot: string
  hardCutoff: string
  maxTripsPerNight: string
  acceptMinutes: string
  autoDispatch: boolean
  acceptHazardous: boolean
}

const FIELDS: { key: Exclude<keyof ShiftTimes, 'maxTripsPerNight' | 'acceptMinutes' | 'autoDispatch' | 'acceptHazardous'>; label: string; hint: string }[] = [
  { key: 'shiftStart', label: 'Shift starts', hint: 'When drivers start collecting (evening).' },
  { key: 'shiftEnd', label: 'Shift ends', hint: 'When collection stops the next morning.' },
  { key: 'planningSnapshot', label: 'Planning snapshot', hint: "Orders paid before this are planned into tonight's routes." },
  { key: 'hardCutoff', label: 'Hard cutoff', hint: "Last time an order can still join tonight's shift (00:00 = midnight)." },
]

export default function ShiftSettingsForm({ initial, hazardSites }: { initial: ShiftTimes; hazardSites: number }) {
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
    <section aria-label="Shift settings" className={PANEL}>
      <fieldset>
        <legend className="text-base font-semibold tracking-tight">Times (Ghana time)</legend>
        <div className="fields mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-ink-2">{f.label}</span>
              <input
                type="time"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className={`${FIELD} mt-1.5 tabular-nums`}
              />
              <span className="mt-1 block text-sm text-ink-3">{f.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="sr-only">Dispatch</legend>
        <p className="text-base font-semibold tracking-tight" aria-hidden>
          Dispatch
        </p>
        <div className="fields mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Trips per night</span>
            <input
              type="number"
              min={1}
              max={8}
              value={values.maxTripsPerNight}
              onChange={(e) => setValues((v) => ({ ...v, maxTripsPerNight: e.target.value }))}
              className={`${FIELD} mt-1.5 tabular-nums`}
            />
            <span className="mt-1 block text-sm text-ink-3">
              Loads one driver can collect and unload in a shift. The planner gives each driver up to capacity × 90% × this.
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Minutes to accept a stop</span>
            <input
              type="number"
              min={5}
              max={120}
              value={values.acceptMinutes}
              onChange={(e) => setValues((v) => ({ ...v, acceptMinutes: e.target.value }))}
              className={`${FIELD} mt-1.5 tabular-nums`}
            />
            <span className="mt-1 block text-sm text-ink-3">
              From when the stop is sent, or from shift start for planned stops. Stops not accepted in time go to the next best driver.
            </span>
          </label>
        </div>

        <label className="mt-5 flex items-start gap-3">
          <input
            type="checkbox"
            checked={values.autoDispatch}
            onChange={(e) => setValues((v) => ({ ...v, autoDispatch: e.target.checked }))}
            className={`${CHECK} mt-1`}
          />
          <span>
            <span className="block text-[15px] font-medium">Assign waiting orders automatically once the shift starts</span>
            <span className="mt-0.5 block text-sm text-ink-3">
              At the planning snapshot ops are told tonight&apos;s plan is ready to approve. With this on, anything not approved by the shift
              start, and every late order after it, goes to the best online driver within a couple of minutes. Off means everything is assigned by
              hand.
            </span>
          </span>
        </label>

        <label className="mt-5 flex items-start gap-3">
          <input
            type="checkbox"
            checked={values.acceptHazardous}
            onChange={(e) => setValues((v) => ({ ...v, acceptHazardous: e.target.checked }))}
            className={`${CHECK} mt-1`}
          />
          <span>
            <span className="block text-[15px] font-medium">Accept hazardous waste bookings</span>
            <span className="mt-0.5 block text-sm text-ink-3">
              Batteries, chemicals, paint, medical waste. These orders are never assigned automatically: plan each one by hand on the Assign
              page, to a site that takes hazardous waste.
            </span>
            {values.acceptHazardous && hazardSites === 0 && (
              <span role="alert" className="mt-1.5 block text-sm font-medium text-danger">
                No active disposal site takes hazardous waste yet. Add one under Disposal sites before turning this on.
              </span>
            )}
          </span>
        </label>
      </fieldset>

      <Result msg={error ? { ok: false, text: error } : saved ? { ok: true, text: 'Saved. New bookings use these hours now.' } : null} />
      <button type="button" onClick={submit} disabled={loading} className={`${BUTTON_PRIMARY} mt-5 w-full sm:w-auto`}>
        {loading ? 'Saving…' : 'Save shift settings'}
      </button>
      <p className="mt-2 text-sm text-ink-3">Changes are logged and apply to new payments only.</p>
    </section>
  )
}
