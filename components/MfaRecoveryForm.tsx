'use client'

import { useState } from 'react'

export default function MfaRecoveryForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError('')
    setSuccess('')
    setLoading(true)

    const res = await fetch('/api/admin/mfa-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: email }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not reset 2FA')
      return
    }

    setSuccess(`2FA reset for ${email}. They can set it up again next login.`)
    setEmail('')
  }

  return (
    <div className="panel">
      <label style={{ fontSize: 12, color: '#666' }}>User's email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input-field"
        placeholder="e.g. driver@example.com"
      />
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {success && <p style={{ color: '#2F7A4D', fontSize: 13, marginBottom: 8 }}>{success}</p>}
      <button onClick={submit} disabled={loading || !email} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Resetting...' : 'Reset 2FA for this user'}
      </button>
    </div>
  )
}