'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MfaEnrollForm({ onEnrolled, redirectTo }: { onEnrolled?: () => void; redirectTo?: string }) {
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function startEnroll() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not start 2FA setup')
      return
    }

    setQrCode(data.qrCode)
    setSecret(data.secret)
    setFactorId(data.factorId)
    setStarted(true)
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/mfa/enroll/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId, code }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not confirm code')
      return
    }

    setDone(true)
    onEnrolled?.()
    if (redirectTo) {
      setTimeout(() => {
        router.push(redirectTo)
        router.refresh()
      }, 1200)
    }
  }

  if (done) {
    return <p style={{ color: '#2F7A4D', fontSize: 14 }}>2FA enabled successfully.</p>
  }

  if (!started) {
    return (
      <div>
        {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button onClick={startEnroll} disabled={loading} className="btn-accent">
          {loading ? 'Starting...' : 'Set up 2FA'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        Scan this QR code with Google Authenticator, Authy, or a similar app.
      </p>
      <div dangerouslySetInnerHTML={{ __html: qrCode }} style={{ marginBottom: 12 }} />
      <p style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>
        Can't scan? Enter this code manually: <code>{secret}</code>
      </p>
      <form onSubmit={confirmCode}>
        <input
          placeholder="Enter the 6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={6}
          inputMode="numeric"
          className="input-field"
        />
        {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? 'Confirming...' : 'Confirm & Enable'}
        </button>
      </form>
    </div>
  )
}