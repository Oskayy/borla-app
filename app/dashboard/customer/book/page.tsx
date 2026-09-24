'use client'

import { useState } from 'react'

export default function BookPickupPage() {
  const [address, setAddress] = useState('')
  const [wasteType, setWasteType] = useState('general')
  const [bagCount, setBagCount] = useState(1)
  const [quote, setQuote] = useState<number | null>(null)
  const [ruleId, setRuleId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function getQuote() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bagCount }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not get a quote')
      return
    }

    setQuote(data.price)
    setRuleId(data.ruleId)
  }

  async function payNow(orderId: string) {
    const res = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Could not start payment')
      return
    }

    window.location.href = data.authorizationUrl
  }

  async function confirmBooking() {
    setError('')
    setLoading(true)

    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, wasteType, bagCount, price: quote, ruleId }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not create booking')
      return
    }

    payNow(data.id)
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Schedule a Pickup</h1>

      <div className="panel">
        <input
          placeholder="Pickup address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input-field"
        />

        <select
          value={wasteType}
          onChange={(e) => setWasteType(e.target.value)}
          className="input-field"
        >
          <option value="general">General waste</option>
          <option value="recyclable">Recyclable (separated)</option>
        </select>

        <label style={{ fontSize: 13, color: '#666' }}>Number of bags: {bagCount}</label>
        <input
          type="range"
          min={1}
          max={10}
          value={bagCount}
          onChange={(e) => setBagCount(Number(e.target.value))}
          style={{ display: 'block', width: '100%', marginBottom: 16 }}
        />

        <button onClick={getQuote} disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? 'Calculating...' : 'Get price'}
        </button>

        {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 12 }}>{error}</p>}

        {quote !== null && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: 22, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>GHS {quote.toFixed(2)}</p>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>Rule used: {ruleId}</p>
            <button onClick={confirmBooking} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
              {loading ? 'Processing...' : 'Confirm booking & pay'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}