'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'
import { AlertCircle, Check } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET } from '@/components/ui'

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
      console.error('[unload] photo upload failed', uploadError)
      setError("Your photo didn't upload. Please check your signal and try again.")
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
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <PhotoCapture
          label={file ? 'Retake photo' : 'Take photo at the site'}
          buttonClassName={`min-h-12 ${BUTTON_QUIET}`}
          onCapture={(f, lat, lng) => {
            setFile(f)
            setGpsLat(lat)
            setGpsLng(lng)
          }}
        />
        {file && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-action-deep">
            <Check aria-hidden className="size-4" strokeWidth={3} /> Photo ready
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <button onClick={confirmDisposal} disabled={loading} className={`min-h-12 w-full ${BUTTON_PRIMARY}`}>
        {loading ? 'Confirming…' : 'Confirm unload'}
      </button>
    </div>
  )
}
