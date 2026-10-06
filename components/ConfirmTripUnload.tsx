'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'
import { AlertCircle, Check, Flag } from 'lucide-react'
import { flash } from '@/components/driver/Flash'
import { BUTTON_PRIMARY, BUTTON_QUIET } from '@/components/ui'

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
      console.error('[unload] photo upload failed', uploadError)
      setError("The photo didn't upload. Check your connection and try again.")
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
      const n = Number(data.orders ?? 0)
      const message = data.verified
        ? `Unload confirmed for ${n} ${n === 1 ? 'order' : 'orders'}. GHS ${Number(data.paid ?? 0).toFixed(2)} added to your earnings.`
        : `Received. Ops will check your photo because ${data.why}. You'll be paid once it's approved.`
      setResult(message)
      // The trip card folds away on refresh, so keep the message on the page above it.
      flash(message, data.verified ? 'ok' : 'warn')
      setFile(null)
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-4">
      <p className="text-[15px] text-ink-2">
        At the site? Take one photo of the unloading to confirm all <strong className="text-ink">{collectedCount}</strong> collected
        {collectedCount === 1 ? ' order' : ' orders'} on this trip.
        {waitingCount > 0 && (
          <span className="text-driver-deep">
            {' '}
            {waitingCount} {waitingCount === 1 ? 'stop' : 'stops'} on this trip aren&apos;t collected yet and will stay on your list.
          </span>
        )}
      </p>
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
      {result && (
        <p role="status" className="rounded-control bg-customer-wash p-3 text-sm text-ink">
          {result}
        </p>
      )}
      <button onClick={confirm} disabled={loading || !file} className={`min-h-12 w-full ${BUTTON_PRIMARY}`}>
        <Flag aria-hidden className="size-5" /> {loading ? 'Confirming…' : 'Confirm unload'}
      </button>
    </div>
  )
}
