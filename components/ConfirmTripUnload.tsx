'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'

// One photo at the disposal site confirms the whole trip.
export default function ConfirmTripUnload({
  routeId,
  tripNumber,
  photoOrderId,
  collectedCount,
  waitingCount,
}: {
  routeId: string
  tripNumber: number
  photoOrderId: string // one of the collected orders; the photo is stored under it
  collectedCount: number
  waitingCount: number // stops on this trip not collected yet
}) {
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function confirm() {
    if (!file) {
      setError('Please take a photo at the disposal site first')
      return
    }
    setError('')
    setLoading(true)

    const filePath = `${photoOrderId}/disposal-trip-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('pickup-evidence').upload(filePath, file)
    if (uploadError) {
      setError('Photo upload failed: ' + uploadError.message)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/driver/trip-disposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, tripNumber, photoPath: filePath, gpsLat, gpsLng }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not confirm unloading')
        return
      }
      setResult(
        data.verified
          ? `Unload confirmed for ${data.orders} order(s). GHS ${Number(data.paid ?? 0).toFixed(2)} added to your earnings.`
          : `Received. Ops will check your photo because ${data.why}. You'll be paid once it's approved.`
      )
      setFile(null)
      router.refresh()
    } catch {
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      <p style={{ fontSize: 13, marginBottom: 8 }}>
        At the site? Take one photo of the unloading to confirm all <strong>{collectedCount}</strong> collected order(s) on
        this trip.
        {waitingCount > 0 && (
          <span style={{ color: '#9A6415' }}> {waitingCount} stop(s) on this trip aren&apos;t collected yet and will stay on your list.</span>
        )}
      </p>
      <PhotoCapture
        label={file ? 'Retake photo' : 'Take photo at site'}
        onCapture={(f, lat, lng) => {
          setFile(f)
          setGpsLat(lat)
          setGpsLng(lng)
        }}
      />
      {file && <p style={{ fontSize: 12, color: '#2F7A4D', margin: '6px 0' }}>Photo captured ✓</p>}
      {error && <p style={{ color: '#B3261E', fontSize: 13, margin: '6px 0' }}>{error}</p>}
      {result && <p style={{ color: '#2F7A4D', fontSize: 13, margin: '6px 0' }}>{result}</p>}
      <button onClick={confirm} disabled={loading || !file} className="btn-accent" style={{ width: '100%', marginTop: 6 }}>
        {loading ? 'Confirming...' : 'Confirm unload'}
      </button>
    </div>
  )
}
