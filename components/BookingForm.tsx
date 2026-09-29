'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import PhotoCapture from '@/components/PhotoCapture'

interface BinSizeOption {
  code: string
  label: string
  litres: number
}

interface QuoteLine {
  code: string
  label: string
  litres: number
  count: number
  lineTotal: number
}

interface Quote {
  price: number
  zoneName: string
  lines: QuoteLine[]
  totalBins: number
  totalLitres: number
  recyclableDiscount: number
  hazardSurcharge: number
  lateSurcharge: number
  isLate: boolean
  collectionLabel: string
}

const MAX_PER_SIZE = 20

export default function BookingForm({
  sizes,
  home,
}: {
  sizes: BinSizeOption[]
  home: { address: string } | null
}) {
  // With a saved home, bookings use it by default. The customer can switch to another address for one order.
  const [useHome, setUseHome] = useState(!!home)
  const [address, setAddress] = useState('')
  const [wasteType, setWasteType] = useState('general')
  const [hazardous, setHazardous] = useState(false)
  const [bins, setBins] = useState<Record<string, number>>({})
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [pendingConfirm, setPendingConfirm] = useState<{
    orderId: string
    distanceMeters: number
    requote: { oldPrice: number; newPrice: number; zoneName: string; collectionLabel: string } | null
  } | null>(null)

  const supabase = createClient()
  const totalBins = Object.values(bins).reduce((a, b) => a + b, 0)
  const pickupAddress = useHome && home ? home.address : address

  // Any change to the order details makes the old price out of date.
  function changed() {
    setQuote(null)
  }

  function setCount(code: string, next: number) {
    const value = Math.max(0, Math.min(MAX_PER_SIZE, next))
    setBins((prev) => ({ ...prev, [code]: value }))
    changed()
  }

  function orderBody() {
    return useHome
      ? { useHome: true, wasteType, hazardous, bins, gpsLat, gpsLng }
      : { address, wasteType, hazardous, bins, gpsLat, gpsLng }
  }

  async function getQuote() {
    if (!useHome && !address.trim()) {
      setError('Please enter your pickup address')
      return
    }
    if (totalBins < 1) {
      setError('Please choose at least one bin')
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody()),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not get a price')
        return
      }
      setQuote(data)
    } catch {
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function payNow(orderId: string) {
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Could not start payment')
        setLoading(false)
        return
      }

      window.location.href = data.authorizationUrl
    } catch {
      setError('Something went wrong starting payment. Please try again.')
      setLoading(false)
    }
  }

  async function confirmBooking() {
    if (!useHome && !address.trim()) {
      setError('Please enter your pickup address')
      return
    }
    if (!file) {
      setError('Please add a photo of your waste before continuing')
      return
    }

    setError('')
    setLoading(true)

    const orderRes = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderBody()),
    })
    const orderData = await orderRes.json()

    if (!orderRes.ok) {
      setLoading(false)
      setError(orderData.error || 'Could not create booking')
      return
    }

    const filePath = `${orderData.id}/placement-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('pickup-evidence').upload(filePath, file)

    if (uploadError) {
      setLoading(false)
      setError('Photo upload failed: ' + uploadError.message)
      return
    }

    const evidenceRes = await fetch('/api/orders/add-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderData.id, photoPath: filePath, type: 'customer_placement', gpsLat, gpsLng }),
    })

    if (!evidenceRes.ok) {
      setLoading(false)
      setError('Order created, but photo could not be saved. Contact support.')
      return
    }

    const evidenceData = await evidenceRes.json()

    if (evidenceData.flagged) {
      setLoading(false)
      setPendingConfirm({
        orderId: orderData.id,
        distanceMeters: evidenceData.distanceMeters,
        requote: evidenceData.requote ?? null,
      })
      return
    }

    await payNow(orderData.id)
  }

  async function confirmAddressAndPay() {
    if (!pendingConfirm) return
    setError('')
    setLoading(true)
    await payNow(pendingConfirm.orderId)
  }

  function goBackAndFixAddress() {
    setPendingConfirm(null)
    setQuote(null)
    setFile(null)
    setGpsLat(null)
    setGpsLng(null)
    setError(
      useHome
        ? 'Please check the pin on your home location page, or choose a different address for this order, then take a new photo.'
        : 'Please update your address to match your location, then take a new photo and try again.'
    )
  }

  if (pendingConfirm) {
    const rq = pendingConfirm.requote
    return (
      <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
        <h1 style={{ fontSize: 26, marginBottom: 20 }}>Double-check your address</h1>
        <div className="panel">
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            Your photo&apos;s location is about <strong>{Math.round(pendingConfirm.distanceMeters)}m</strong> from the
            pickup address (<strong>{pickupAddress}</strong>). This can happen if your phone&apos;s location is briefly
            inaccurate, or if the address you typed doesn&apos;t quite match where you are.
          </p>

          {rq && (
            <div style={{ background: '#FFF6E5', border: '1px solid var(--color-accent)', borderRadius: 4, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 14 }}>
                Your photo was taken in <strong>{rq.zoneName}</strong>, where pickups cost more. The price has been
                updated from <strong>GHS {rq.oldPrice.toFixed(2)}</strong> to{' '}
                <strong>GHS {rq.newPrice.toFixed(2)}</strong>.
              </p>
            </div>
          )}

          <p style={{ fontSize: 14, marginBottom: 20 }}>
            Is <strong>{pickupAddress}</strong> correct?
          </p>

          {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button onClick={confirmAddressAndPay} disabled={loading} className="btn-accent" style={{ width: '100%', marginBottom: 8 }}>
            {loading
              ? 'Processing...'
              : rq
              ? `Yes, continue and pay GHS ${rq.newPrice.toFixed(2)}`
              : 'Yes, this address is correct — proceed to payment'}
          </button>
          <button
            onClick={goBackAndFixAddress}
            disabled={loading}
            style={{ width: '100%', background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: 10, fontSize: 14 }}
          >
            No, let me fix the address
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Schedule a Pickup</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Book any time. Collections happen overnight, and you&apos;ll see your collection night before you pay.
      </p>

      <div className="panel">
        <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>Pickup address</label>
        {home ? (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <input
                type="radio"
                checked={useHome}
                onChange={() => {
                  setUseHome(true)
                  changed()
                }}
                style={{ marginTop: 3 }}
              />
              <span>
                My home: <strong>{home.address}</strong>{' '}
                <Link href="/dashboard/customer/home-location" style={{ fontSize: 12 }}>
                  change
                </Link>
              </span>
            </label>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                checked={!useHome}
                onChange={() => {
                  setUseHome(false)
                  changed()
                }}
              />
              A different address for this order
            </label>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            Tip: <Link href="/dashboard/customer/home-location">save your home location</Link> once and you won&apos;t
            need to type it again.
          </p>
        )}
        {!useHome && (
          <input
            placeholder="e.g. House 12, near Chemu Secondary School, Tema Community 4"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              changed()
            }}
            className="input-field"
          />
        )}

        <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 8 }}>Your bins</label>
        {sizes.length === 0 && (
          <p style={{ fontSize: 13, color: '#B3261E', marginBottom: 12 }}>Booking is not available right now. Please try again later.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {sizes.map((size) => {
            const count = bins[size.code] ?? 0
            return (
              <div
                key={size.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '8px 12px',
                  background: count > 0 ? '#F2F7F4' : 'white',
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{size.label}</p>
                  <p style={{ fontSize: 12, color: '#666' }}>about {size.litres} litres</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    aria-label={`Remove one ${size.label.toLowerCase()}`}
                    onClick={() => setCount(size.code, count - 1)}
                    disabled={count === 0}
                    style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid var(--color-border)', background: 'white', fontSize: 18 }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{count}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${size.label.toLowerCase()}`}
                    onClick={() => setCount(size.code, count + 1)}
                    disabled={count >= MAX_PER_SIZE}
                    style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: 18 }}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <select
          value={wasteType}
          onChange={(e) => {
            setWasteType(e.target.value)
            changed()
          }}
          className="input-field"
        >
          <option value="general">General waste</option>
          <option value="recyclable">Recyclable (separated)</option>
        </select>

        <label style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={hazardous}
            onChange={(e) => {
              setHazardous(e.target.checked)
              changed()
            }}
            style={{ marginTop: 3 }}
          />
          <span>
            Contains hazardous items (batteries, chemicals, paint, medical waste). An extra charge applies.
          </span>
        </label>

        <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>Photo of your waste (required)</label>
        <PhotoCapture
          label={file ? 'Retake Photo' : 'Take Photo'}
          onCapture={(f, lat, lng) => {
            setFile(f)
            setGpsLat(lat)
            setGpsLng(lng)
          }}
        />
        {file && <p style={{ fontSize: 12, color: '#2F7A4D', marginTop: 6 }}>Photo captured ✓</p>}

        <button onClick={getQuote} disabled={loading || sizes.length === 0} className="btn-primary" style={{ width: '100%', marginTop: 16 }}>
          {loading && !quote ? 'Calculating...' : 'Get price'}
        </button>

        {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 12 }}>{error}</p>}

        {quote && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 13, color: '#444', marginBottom: 10 }}>
              {quote.lines.map((l) => (
                <div key={l.code} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {l.count} × {l.label}
                  </span>
                  <span>GHS {l.lineTotal.toFixed(2)}</span>
                </div>
              ))}
              {quote.recyclableDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2F7A4D' }}>
                  <span>Recyclable discount</span>
                  <span>− GHS {quote.recyclableDiscount.toFixed(2)}</span>
                </div>
              )}
              {quote.hazardSurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hazardous items</span>
                  <span>+ GHS {quote.hazardSurcharge.toFixed(2)}</span>
                </div>
              )}
              {quote.lateSurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Late booking</span>
                  <span>+ GHS {quote.lateSurcharge.toFixed(2)}</span>
                </div>
              )}
              <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Area: {quote.zoneName}</p>
            </div>

            <p style={{ fontSize: 22, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>GHS {quote.price.toFixed(2)}</p>

            <div style={{ background: '#EEF4F4', borderRadius: 4, padding: 10, margin: '10px 0 14px', fontSize: 13 }}>
              <strong>Collection: {quote.collectionLabel}.</strong>
              <br />
              Please put your bins out before the collection starts.
            </div>

            <button onClick={confirmBooking} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
              {loading ? 'Processing...' : 'Confirm booking & pay'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}