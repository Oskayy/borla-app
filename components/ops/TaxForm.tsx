'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'
import { PANEL, Result } from '@/components/ops/kit'

type Rates = { vatPercent: number; nhilPercent: number; getfundPercent: number; withholdingPercent: number }

const FIELDS: { key: keyof Rates; label: string }[] = [
  { key: 'vatPercent', label: 'VAT (%)' },
  { key: 'nhilPercent', label: 'NHIL (%)' },
  { key: 'getfundPercent', label: 'GETFund levy (%)' },
  { key: 'withholdingPercent', label: 'Withholding on driver pay (%)' },
]

// Tax rates: shown on prices and receipts, recorded as owed in the ledger, and refunded with refunds.
export default function TaxForm({ current }: { current: Rates }) {
  const [v, setV] = useState(Object.fromEntries(FIELDS.map((f) => [f.key, String(current[f.key])])) as Record<keyof Rates, string>)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  const allZero = FIELDS.every((f) => Number(current[f.key]) === 0)

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, Number(v[f.key] || 0)]))),
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? { ok: true, text: 'Saved. New prices and payouts use these rates.' } : { ok: false, text: data.error || 'Could not save' })
      if (res.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="h-tax" className={PANEL}>
      <h2 id="h-tax" className="text-base font-semibold tracking-tight">
        Tax
      </h2>
      <p className="mt-1 text-sm text-ink-3">
        {allZero ? 'All rates are 0, so customers pay no tax and nothing is withheld from drivers. ' : ''}Set these only with your accountant&apos;s
        confirmed rates. VAT and levies are added on top of the price and shown on the booking and receipt; withholding is taken from each driver
        payout. Orders already paid keep the tax they were charged.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span className="text-sm font-medium text-ink-2">{f.label}</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.01}
              value={v[f.key]}
              onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))}
              className={`${FIELD} mt-1.5 tabular-nums`}
            />
          </label>
        ))}
      </div>
      <Result msg={msg} />
      <button
        type="button"
        disabled={busy}
        onClick={() => confirm('Change the tax rates? Customers pay the new VAT and levies on every new booking.') && save()}
        className={`${BUTTON_PRIMARY} mt-4`}
      >
        {busy ? 'Saving…' : 'Save tax rates'}
      </button>
    </section>
  )
}
