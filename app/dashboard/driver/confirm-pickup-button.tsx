'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'
import { errorMessage } from '@/lib/errors'
import { AlertCircle, Camera, Check } from 'lucide-react'
import { flash } from '@/components/driver/Flash'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'

export default function ConfirmPickupButton({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [reporting, setReporting] = useState(false)
  const [issueType, setIssueType] = useState('LOCKED_GATE')
  const [note, setNote] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function uploadPhoto(prefix: string) {
    if (!file) return null
    const filePath = `${orderId}/${prefix}-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('pickup-evidence')
      .upload(filePath, file)
    if (uploadError) {
      console.error('[pickup] photo upload failed', uploadError)
      throw new Error("Your photo didn't upload. Please check your signal and try again.")
    }
    return filePath
  }

  async function confirmPickup() {
    if (!file) {
      setError('Please take a photo first')
      return
    }
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const photoPath = await uploadPhoto('pickup')
      const res = await fetch('/api/orders/confirm-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, photoPath, gpsLat, gpsLng, gpsAccuracy }),
      })
      const data = await res.json()
      setLoading(false)
      if (res.ok) {
        if (data.flagged) {
          const text = `Pickup confirmed, but the photo was taken about ${Math.round(data.distanceMeters)} m from the pin, so ops will check it.`
          setWarning(text)
          flash(text, 'warn') // this card goes away on refresh; keep the warning on the page
        } else {
          flash('Pickup confirmed.')
        }
        router.refresh()
      } else {
        setError(data.error || 'Failed to confirm pickup')
      }
    } catch (e) {
      setLoading(false)
      setError(errorMessage(e))
    }
  }

  async function submitIssue() {
    setError('')
    setLoading(true)
    try {
      const photoPath = await uploadPhoto('issue')
      const res = await fetch('/api/orders/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, issueType, note, photoPath, gpsLat, gpsLng }),
      })
      setLoading(false)
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to report issue')
      }
    } catch (e) {
      setLoading(false)
      setError(errorMessage(e))
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <PhotoCapture
          label={file ? 'Retake photo' : 'Take pickup photo'}
          buttonClassName={`min-h-12 ${BUTTON_QUIET}`}
          onCapture={(f, lat, lng, accuracy) => {
            setFile(f)
            setGpsLat(lat)
            setGpsLng(lng)
            setGpsAccuracy(accuracy ?? null)
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
      {warning && (
        <p role="status" className="rounded-control bg-driver-wash p-3 text-sm text-ink">
          {warning}
        </p>
      )}

      {!reporting ? (
        <div className="grid gap-2">
          <button onClick={confirmPickup} disabled={loading} className={`min-h-12 w-full ${BUTTON_PRIMARY}`}>
            <Camera aria-hidden className="size-5" /> {loading ? 'Confirming…' : 'Confirm pickup'}
          </button>
          <button onClick={() => setReporting(true)} disabled={loading} className="min-h-11 text-sm font-semibold text-ink-3 hover:text-ink">
            Can&apos;t collect? Report a problem
          </button>
        </div>
      ) : (
        <div className="grid gap-3 border-t border-line pt-4">
          <label className="text-sm font-medium text-ink-2" htmlFor={`issue-${orderId}`}>
            What happened?
          </label>
          <select id={`issue-${orderId}`} value={issueType} onChange={(e) => setIssueType(e.target.value)} className={FIELD}>
            <option value="LOCKED_GATE">Locked gate / no bin I can reach</option>
            <option value="SPILL_HAZARD">Spill or hazard concern</option>
          </select>
          <textarea
            placeholder="Short note for ops"
            aria-label="Note for ops"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={FIELD}
            rows={3}
          />
          <button onClick={submitIssue} disabled={loading} className={`min-h-12 w-full ${BUTTON_PRIMARY}`}>
            {loading ? 'Sending…' : 'Send report'}
          </button>
          <button onClick={() => setReporting(false)} disabled={loading} className="min-h-11 text-sm font-semibold text-ink-3 hover:text-ink">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
