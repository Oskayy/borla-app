'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PayoutRuleForm() {
  const [pickupPercent, setPickupPercent] = useState('40')
  const [disposalPercent, setDisposalPercent] = useState('60')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/admin/payout-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupPercent, disposalPercent }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to create rule')
      return
    }

    router.refresh()
  }

  return (
    <div className="panel">
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginBottom: 12 }}>Add New Payout Rule</h2>

      <label style={{ fontSize: 12, color: '#666' }}>Pickup payout (%)</label>
      <input
        type="number"
        value={pickupPercent}
        onChange={(e) => setPickupPercent(e.target.value)}
        className="input-field"
      />

      <label style={{ fontSize: 12, color: '#666' }}>Disposal payout (%)</label>
      <input
        type="number"
        value={disposalPercent}
        onChange={(e) => setDisposalPercent(e.target.value)}
        className="input-field"
      />

      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <button onClick={submit} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Saving...' : 'Activate This Rule'}
      </button>
      <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
        Must add up to 100%. This only affects future pickups/disposals — not orders already in progress.
      </p>
    </div>
  )
}