'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'

export default function ConfirmDisposalButton({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function confirmDisposal() {
    if (!file) {
      setError('Please take a photo first')
      return
    }

    setError('')
    setLoading(true)

    const filePath = `${orderId}/disposal-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('pickup-evidence')
      .upload(filePath, file)

    if (uploadError) {
      setError('Photo upload failed: ' + uploadError.message)
      setLoading(false)
      return
    }

    const res = await fetch('/api/orders/confirm-disposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, photoPath: filePath, gpsLat, gpsLng }),
    })

    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to confirm disposal')
    }
  }

  return (
    <div>
      <PhotoCapture
        label={file ? 'Retake Photo' : 'Take Photo'}
        onCapture={(f, lat, lng) => {
          setFile(f)
          setGpsLat(lat)
          setGpsLng(lng)
        }}
      />
      {file && <p style={{ fontSize: 12, color: '#2F7A4D', margin: '6px 0' }}>Photo captured ✓</p>}
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button onClick={confirmDisposal} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Confirming...' : 'Confirm Disposal'}
      </button>
    </div>
  )
}