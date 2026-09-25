'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ConfirmPickupButton({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function confirmPickup() {
    if (!file) {
      setError('Please take or select a photo first')
      return
    }

    setError('')
    setLoading(true)

    // 1. Upload the photo to Supabase Storage
    const filePath = `${orderId}/pickup-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('pickup-evidence')
      .upload(filePath, file)

    if (uploadError) {
      setError('Photo upload failed: ' + uploadError.message)
      setLoading(false)
      return
    }

    // 2. Tell our backend the photo is uploaded, and to proceed with confirmation
    const res = await fetch('/api/orders/confirm-pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, photoPath: filePath }),
    })

    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to confirm pickup')
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="input-field"
        style={{ marginBottom: 8 }}
      />
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button onClick={confirmPickup} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Confirming...' : 'Confirm Pickup'}
      </button>
    </div>
  )
}