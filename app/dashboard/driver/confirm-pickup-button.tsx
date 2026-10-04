'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import PhotoCapture from '@/components/PhotoCapture'
import { errorMessage } from '@/lib/errors'

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
    if (uploadError) throw new Error(uploadError.message)
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
          setWarning(
            `Location check: this photo was taken about ${Math.round(
              data.distanceMeters
            )}m from the pickup address. Pickup was still confirmed, but this has been flagged for ops review.`
          )
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
    <div>
      <PhotoCapture
        label={file ? 'Retake Photo' : 'Take Photo'}
        onCapture={(f, lat, lng, accuracy) => {
          setFile(f)
          setGpsLat(lat)
          setGpsLng(lng)
          setGpsAccuracy(accuracy ?? null)
        }}
      />
      {file && <p style={{ fontSize: 12, color: '#2F7A4D', margin: '6px 0' }}>Photo captured ✓</p>}
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {warning && <p style={{ color: '#E8A33D', fontSize: 13, marginBottom: 8 }}>{warning}</p>}

      {!reporting ? (
        <>
          <button onClick={confirmPickup} disabled={loading} className="btn-accent" style={{ width: '100%', marginBottom: 8 }}>
            {loading ? 'Confirming...' : 'Confirm Pickup'}
          </button>
          <button
            onClick={() => setReporting(true)}
            disabled={loading}
            style={{ width: '100%', background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: 8, fontSize: 13 }}
          >
            Report an issue instead
          </button>
        </>
      ) : (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 10 }}>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="input-field">
            <option value="LOCKED_GATE">Locked gate / no bin accessible</option>
            <option value="SPILL_HAZARD">Spill or hazard concern</option>
          </select>
          <textarea
            placeholder="Brief note (what happened?)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input-field"
            rows={3}
          />
          <button onClick={submitIssue} disabled={loading} className="btn-primary" style={{ width: '100%', marginBottom: 8 }}>
            {loading ? 'Submitting...' : 'Submit report'}
          </button>
          <button
            onClick={() => setReporting(false)}
            disabled={loading}
            style={{ width: '100%', background: 'none', border: 'none', fontSize: 13, color: '#666' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}