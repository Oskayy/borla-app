'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BinSizeOption {
  code: string
  label: string
  litres: number
}

const labelStyle = { fontSize: 12, color: '#666' } as const
const hintStyle = { fontSize: 11, color: '#999', marginTop: -8, marginBottom: 12 } as const

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
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to create rule')
      return
    }

    setName('')
    router.refresh()
  }

  return (
    <div className="panel">
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginBottom: 12 }}>Add New Pricing Rule</h2>

      <label style={labelStyle}>Rule name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Standard Household" />

      <p style={{ fontSize: 13, fontWeight: 600, margin: '4px 0 8px' }}>Fee per bin</p>
      {sizes.map((size) => (
        <div key={size.code}>
          <label style={labelStyle}>
            {size.label} ({size.litres} L), GHS
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={binFees[size.code] ?? ''}
            onChange={(e) => setBinFees((prev) => ({ ...prev, [size.code]: e.target.value }))}
            className="input-field"
            placeholder="e.g. 10"
          />
        </div>
      ))}

      <label style={labelStyle}>Per-bin charge (GHS, added to every bin)</label>
      <input type="number" min="0" value={volumeRate} onChange={(e) => setVolumeRate(e.target.value)} className="input-field" />

      <label style={labelStyle}>Base fee per order (GHS)</label>
      <input type="number" min="0" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} className="input-field" />
      <p style={hintStyle}>The base fee and bin fees are multiplied by the pickup zone&apos;s multiplier (set on the Zones page).</p>

      <label style={labelStyle}>Hazard surcharge (GHS)</label>
      <input type="number" min="0" value={hazardSurcharge} onChange={(e) => setHazardSurcharge(e.target.value)} className="input-field" placeholder="e.g. 5" />

      <label style={labelStyle}>Late booking surcharge (GHS)</label>
      <input type="number" min="0" value={lateSurcharge} onChange={(e) => setLateSurcharge(e.target.value)} className="input-field" />
      <p style={hintStyle}>Charged on orders booked after the planning snapshot for tonight&apos;s shift. 0 = off.</p>

      <label style={labelStyle}>Recyclable (separated) discount (%)</label>
      <input
        type="number"
        min="0"
        max="100"
        value={separatedDiscountPercent}
        onChange={(e) => setSeparatedDiscountPercent(e.target.value)}
        className="input-field"
      />

      <label style={labelStyle}>Platform fee (% of price kept by Trashit)</label>
      <input
        type="number"
        min="0"
        max="50"
        value={platformFeePercent}
        onChange={(e) => setPlatformFeePercent(e.target.value)}
        className="input-field"
        placeholder="e.g. 15"
      />
      <p style={hintStyle}>Customers don&apos;t see this. Drivers share the rest (pickup % + disposal % from Payout Rules).</p>

      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <button onClick={submit} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Saving...' : 'Activate This Rule'}
      </button>
      <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
        Activating a new rule automatically deactivates the current one. Existing orders keep their original quote.
      </p>
    </div>
  )
}
