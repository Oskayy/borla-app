'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoCapture from '@/components/PhotoCapture'
import { AlertCircle, Check, Flag } from 'lucide-react'
import { flash } from '@/components/driver/Flash'
import { sendOrQueue } from '@/lib/outbox'
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

  async function confirm() {
    if (!file) {
      setError('Please take a photo at the disposal site first')
      return
    }
    setError('')
    setLoading(true)

    // Without signal the unload is kept on the phone and sent later (lib/outbox.ts).
    const r = await sendOrQueue({
      kind: 'trip-unload',
      label: `Unload for trip ${tripNumber}`,
      url: '/api/driver/trip-disposal',
      body: { routeId, tripNumber, gpsLat, gpsLng },
      photo: file,
      photoPath: `${photoOrderId}/disposal-trip-${Date.now()}.jpg`,
    })
    setLoading(false)
    if (r.status === 'failed') {
      setError(r.error)
      return
    }
    let message: string
    if (r.status === 'queued') {
      message = 'No signal. The unload and its photo are saved on this phone and will send by themselves.'
    } else {
      const data = r.data
      const n = Number(data.orders ?? 0)
      message = data.already
        ? 'This unload was already confirmed.'
        : data.verified
          ? `Unload confirmed for ${n} ${n === 1 ? 'order' : 'orders'}. GHS ${Number(data.paid ?? 0).toFixed(2)} added to your earnings.`
          : `Received. Ops will check your photo because ${data.why}. You'll be paid once it's approved.`
    }
    setResult(message)
    // The trip card folds away on refresh, so keep the message on the page above it.
    flash(message, r.status === 'sent' && r.data.verified ? 'ok' : 'warn')
    setFile(null)
    if (r.status === 'sent') router.refresh()
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
