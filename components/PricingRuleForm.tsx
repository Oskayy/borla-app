'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { PANEL, Result } from '@/components/ops/kit'

interface BinSizeOption {
  code: string
  label: string
  litres: number
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-3">{hint}</span>}
    </label>
  )
}

const INPUT = `${FIELD} mt-1.5 tabular-nums`

export default function PricingRuleForm({ sizes }: { sizes: BinSizeOption[] }) {
  const [name, setName] = useState('')
  const [baseFee, setBaseFee] = useState('0')
  const [binFees, setBinFees] = useState<Record<string, string>>({})
  const [volumeRate, setVolumeRate] = useState('0')
  const [hazardSurcharge, setHazardSurcharge] = useState('')
  const [lateSurcharge, setLateSurcharge] = useState('0')
  const [platformFeePercent, setPlatformFeePercent] = useState('')
  const [separatedDiscountPercent, setSeparatedDiscountPercent] = useState('15')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          baseFee,
          binFees,
          volumeRate,
          hazardSurcharge,
          lateSurcharge,
          platformFeePercent,
          separatedDiscountPercent,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create rule')
        return
      }
      setName('')
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="h-new-price" className={PANEL}>
      <h2 id="h-new-price" className="text-base font-semibold tracking-tight">
        New pricing rule
      </h2>

      <div className="mt-4 grid gap-5">
        <Field label="Rule name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Standard household" />
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Fee per bin (GHS)</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            {sizes.map((size) => (
              <Field key={size.code} label={`${size.label} (${size.litres} L)`}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={binFees[size.code] ?? ''}
                  onChange={(e) => setBinFees((prev) => ({ ...prev, [size.code]: e.target.value }))}
                  className={INPUT}
                  placeholder="e.g. 10"
                />
              </Field>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Per-bin charge (GHS)" hint="Added to every bin.">
            <input type="number" min="0" value={volumeRate} onChange={(e) => setVolumeRate(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Base fee per order (GHS)" hint="Base and bin fees are multiplied by the zone's multiplier (Zones page).">
            <input type="number" min="0" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Hazard surcharge (GHS)">
            <input type="number" min="0" value={hazardSurcharge} onChange={(e) => setHazardSurcharge(e.target.value)} className={INPUT} placeholder="e.g. 5" />
          </Field>
          <Field label="Late booking surcharge (GHS)" hint="On orders booked after tonight's planning snapshot. 0 = off.">
            <input type="number" min="0" value={lateSurcharge} onChange={(e) => setLateSurcharge(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Recyclable discount (%)" hint="For waste the customer has separated.">
            <input type="number" min="0" max="100" value={separatedDiscountPercent} onChange={(e) => setSeparatedDiscountPercent(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Platform fee (% kept by Trashit)" hint="Customers don't see this. Drivers share the rest (Payout rules).">
            <input
              type="number"
              min="0"
              max="50"
              value={platformFeePercent}
              onChange={(e) => setPlatformFeePercent(e.target.value)}
              className={INPUT}
              placeholder="e.g. 15"
            />
          </Field>
        </div>
      </div>

      <Result msg={error ? { ok: false, text: error } : null} />
      <button type="button" onClick={submit} disabled={loading} className={`${BUTTON_PRIMARY} mt-5 w-full sm:w-auto`}>
        {loading ? 'Saving…' : 'Make this the active rule'}
      </button>
      <p className="mt-2 text-sm text-ink-3">The current rule is switched off. Orders already booked keep the price they were quoted.</p>
    </section>
  )
}
