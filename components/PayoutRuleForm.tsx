'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { PANEL, Result } from '@/components/ops/kit'

export interface PayoutRuleValues {
  pickupPercent: number
  disposalPercent: number
  lateSurchargeDriverPercent: number
  hazardSurchargeDriverPercent: number
  recyclableDiscountPlatformPercent: number
  distanceFreeKm: number
  distanceBonusPerKm: number
  distanceBonusCap: number
}

function Field({ label, hint, value, onChange, step = 1 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; step?: number }) {
  return (
    <label>
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} mt-1.5 tabular-nums`} />
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

// A new payout rule, starting from the active one.
export default function PayoutRuleForm({ current }: { current: PayoutRuleValues | null }) {
  const start = (k: keyof PayoutRuleValues, d: number) => String(current?.[k] ?? d)
  const [v, setV] = useState({
    pickupPercent: start('pickupPercent', 40),
    disposalPercent: start('disposalPercent', 60),
    lateSurchargeDriverPercent: start('lateSurchargeDriverPercent', 100),
    hazardSurchargeDriverPercent: start('hazardSurchargeDriverPercent', 100),
    recyclableDiscountPlatformPercent: start('recyclableDiscountPlatformPercent', 100),
    distanceFreeKm: start('distanceFreeKm', 3),
    distanceBonusPerKm: start('distanceBonusPerKm', 1),
    distanceBonusCap: start('distanceBonusCap', 10),
  })
  const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const total = Number(v.pickupPercent || 0) + Number(v.disposalPercent || 0)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payout-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]))),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create rule')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="h-new-rule" className={PANEL}>
      <h2 id="h-new-rule" className="text-base font-semibold tracking-tight">
        New payout rule
      </h2>
      <p className="mt-1 text-sm text-ink-3">Starts from the active rule. Change what you need, then make it active.</p>

      <h3 className="mt-5 text-sm font-semibold">When drivers are paid</h3>
      <p className="text-sm text-ink-3">How the driver pool (the order price after the platform fee) is split between the two moments of a stop.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="At pickup (%)" value={v.pickupPercent} onChange={set('pickupPercent')} />
        <Field label="At unload (%)" value={v.disposalPercent} onChange={set('disposalPercent')} />
      </div>
      <p className={`mt-2 text-sm tabular-nums ${total === 100 ? 'text-ink-3' : 'font-medium text-danger'}`}>
        Total {total}%{total === 100 ? '' : ' (must be 100%)'}
      </p>

      <h3 className="mt-6 text-sm font-semibold">Surcharges and the recyclable discount</h3>
      <p className="text-sm text-ink-3">The rest of each surcharge goes to Trashit; the rest of the discount comes out of the drivers&apos; share.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label="Late surcharge to drivers (%)" value={v.lateSurchargeDriverPercent} onChange={set('lateSurchargeDriverPercent')} />
        <Field label="Hazardous surcharge to drivers (%)" value={v.hazardSurchargeDriverPercent} onChange={set('hazardSurchargeDriverPercent')} />
        <Field label="Recyclable discount Trashit absorbs (%)" value={v.recyclableDiscountPlatformPercent} onChange={set('recyclableDiscountPlatformPercent')} />
      </div>

      <h3 className="mt-6 text-sm font-semibold">Distance bonus</h3>
      <p className="text-sm text-ink-3">For stops far from the driver&apos;s home base, paid from Trashit&apos;s fee and fixed when the stop is assigned. Set GHS per km to 0 to turn it off.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label="Free distance (km)" value={v.distanceFreeKm} onChange={set('distanceFreeKm')} step={0.5} />
        <Field label="GHS per km beyond it" value={v.distanceBonusPerKm} onChange={set('distanceBonusPerKm')} step={0.1} />
        <Field label="Most per stop (GHS)" value={v.distanceBonusCap} onChange={set('distanceBonusCap')} step={0.5} />
      </div>

      <Result msg={error ? { ok: false, text: error } : null} />
      <button type="button" onClick={submit} disabled={loading || total !== 100} className={`${BUTTON_PRIMARY} mt-5 w-full sm:w-auto`}>
        {loading ? 'Saving…' : 'Make this the active rule'}
      </button>
      <p className="mt-2 text-sm text-ink-3">Only affects orders paid (and, for the bonus, stops assigned) from now on, not money already paid.</p>
    </section>
  )
}
