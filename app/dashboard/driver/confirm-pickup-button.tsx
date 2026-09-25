'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ConfirmPickupButton({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
      setError('Please take or select a photo first')
      return
    }
    setError('')
    setLoading(true)
    try {
      const photoPath = await uploadPhoto('pickup')
      const res = await fetch('/api/orders/confirm-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, photoPath }),
      })
      setLoading(false)
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to confirm pickup')
      }
    } catch (e: any) {
      setLoading(false)
      setError(e.message)
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
        body: JSON.stringify({ orderId, issueType, note, photoPath }),
      })
      setLoading(false)
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to report issue')
      }
    } catch (e: any) {
      setLoading(false)
      setError(e.message)
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