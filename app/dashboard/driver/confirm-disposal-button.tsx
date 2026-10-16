'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoCapture from '@/components/PhotoCapture'
import { AlertCircle, Check } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET } from '@/components/ui'
import { flash } from '@/components/driver/Flash'
import { sendOrQueue } from '@/lib/outbox'

export default function ConfirmDisposalButton({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function confirmDisposal() {
    if (!file) {
      setError('Please take a photo first')
      return
    }

    setError('')
    setLoading(true)

    // Without signal the unload is kept on the phone and sent later (lib/outbox.ts).
    const r = await sendOrQueue({
      kind: 'unload',
      label: 'An unload',
      url: '/api/orders/confirm-disposal',
      body: { orderId, gpsLat, gpsLng },
      photo: file,
      photoPath: `${orderId}/disposal-${Date.now()}.jpg`,
    })
    setLoading(false)
    if (r.status === 'sent') router.refresh()
    else if (r.status === 'queued') {
      flash('No signal. The unload and its photo are saved on this phone and will send by themselves.', 'warn')
      setFile(null)
    } else setError(r.error)
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
