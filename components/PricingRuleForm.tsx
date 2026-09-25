'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingRuleForm() {
  const [name, setName] = useState('')
  const [baseFee, setBaseFee] = useState('')
  const [volumeRate, setVolumeRate] = useState('')
  const [zoneMultiplier, setZoneMultiplier] = useState('1')
  const [hazardSurcharge, setHazardSurcharge] = useState('')
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
      body: JSON.stringify({ name, baseFee, volumeRate, zoneMultiplier, hazardSurcharge, separatedDiscountPercent }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to create rule')
      return
    }

    setName('')
    setBaseFee('')
    setVolumeRate('')
    setZoneMultiplier('1')
    setHazardSurcharge('')
    setSeparatedDiscountPercent('15')
    router.refresh()
  }

  return (
    <div className="panel">
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginBottom: 12 }}>Add New Pricing Rule</h2>

      <label style={{ fontSize: 12, color: '#666' }}>Rule name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input-field"
        placeholder="e.g. Standard Household"
      />

      <label style={{ fontSize: 12, color: '#666' }}>Base fee (GHS)</label>
      <input
        type="number"
        value={baseFee}
        onChange={(e) => setBaseFee(e.target.value)}
        className="input-field"
        placeholder="e.g. 15"
      />

      <label style={{ fontSize: 12, color: '#666' }}>Volume rate (GHS per bag)</label>
      <input
        type="number"
        value={volumeRate}
        onChange={(e) => setVolumeRate(e.target.value)}
        className="input-field"
        placeholder="e.g. 3"
      />

      <label style={{ fontSize: 12, color: '#666' }}>Zone multiplier</label>
      <input
        type="number"
        step="0.1"
        value={zoneMultiplier}
        onChange={(e) => setZoneMultiplier(e.target.value)}
        className="input-field"
        placeholder="e.g. 1.0"
      />

      <label style={{ fontSize: 12, color: '#666' }}>Hazard surcharge (GHS)</label>
      <input
        type="number"
        value={hazardSurcharge}
        onChange={(e) => setHazardSurcharge(e.target.value)}
        className="input-field"
        placeholder="e.g. 5"
      />

      <label style={{ fontSize: 12, color: '#666' }}>Separated waste discount (%)</label>
      <input
        type="number"
        value={separatedDiscountPercent}
        onChange={(e) => setSeparatedDiscountPercent(e.target.value)}
        className="input-field"
        placeholder="e.g. 15"
      />

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