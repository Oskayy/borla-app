'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'

export default function BookPickupPage() {
  const [address, setAddress] = useState('')
  const [wasteType, setWasteType] = useState('general')
  const [bagCount, setBagCount] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [quote, setQuote] = useState<number | null>(null)
  const [ruleId, setRuleId] = useState('')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function getQuote() {
    if (!address.trim()) {
      setError('Please enter your pickup address')
      return
    }

    setError('')
    setLoading(true)
    const res = await fetch('/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bagCount, wasteType }),
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
    if (!address.trim()) {
      setError('Please enter your pickup address')
      return
    }

    if (!file) {
      setError('Please add a photo of your waste before continuing')
      return
    }

    setError('')
    setWarning('')
    setLoading(true)

    const orderRes = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, wasteType, bagCount, price: quote, ruleId, gpsLat, gpsLng }),
    })
    const orderData = await orderRes.json()

    if (!orderRes.ok) {
      setLoading(false)
      setError(orderData.error || 'Could not create booking')
      return
    }

    const filePath = `${orderData.id}/placement-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('pickup-evidence')
      .upload(filePath, file)

    if (uploadError) {
      setLoading(false)
      setError('Photo upload failed: ' + uploadError.message)
      return
    }

    const evidenceRes = await fetch('/api/orders/add-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderData.id,
        photoPath: filePath,
        type: 'customer_placement',
        gpsLat,
        gpsLng,
      }),
    })

    if (!evidenceRes.ok) {
      setLoading(false)
      setError('Order created, but photo could not be saved. Contact support.')
      return
    }

    const evidenceData = await evidenceRes.json()
    if (evidenceData.flagged) {
      setWarning(
        `Heads up: your photo's location is about ${Math.round(
          evidenceData.distanceMeters
        )}m from the address you entered. We'll still process your booking, but please double-check the address is correct.`
      )
    }

    payNow(orderData.id)
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Schedule a Pickup</h1>

      <div className="panel">
        <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>
          Pickup address (required)
        </label>
        <input
          placeholder="e.g. House 12, near Chemu Secondary School, Tema Community 4"
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

        <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>
          Photo of your waste (required)
        </label>
        <PhotoCapture
          label={file ? 'Retake Photo' : 'Take Photo'}
          onCapture={(f, lat, lng) => {
            setFile(f)
            setGpsLat(lat)
            setGpsLng(lng)
          }}
        />
        {file && <p style={{ fontSize: 12, color: '#2F7A4D', marginTop: 6 }}>Photo captured ✓</p>}

        <button onClick={getQuote} disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 16 }}>
          {loading ? 'Calculating...' : 'Get price'}
        </button>

        {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 12 }}>{error}</p>}
        {warning && <p style={{ color: '#E8A33D', fontSize: 13, marginTop: 12 }}>{warning}</p>}

        {quote !== null && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: 22, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>GHS {quote.toFixed(2)}</p>
            <button onClick={confirmBooking} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
              {loading ? 'Processing...' : 'Confirm booking & pay'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}