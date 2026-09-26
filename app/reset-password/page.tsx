'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function checkStrength(password: string) {
  return [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'One number', pass: /[0-9]/.test(password) },
    { label: 'One symbol (e.g. ! @ # $)', pass: /[^A-Za-z0-9]/.test(password) },
  ]
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const checks = checkStrength(password)
  const allPass = checks.every((c) => c.pass)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allPass) {
      setError('Please meet all password requirements below')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not reset password')
      return
    }

    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Choose a new password</h1>
        {done ? (
          <p style={{ fontSize: 14, color: '#2F7A4D', marginTop: 12 }}>Password updated. Redirecting to login...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="input-field"
            />
            <div style={{ marginBottom: 16, marginTop: -8 }}>
              {checks.map((c) => (
                <p key={c.label} style={{ fontSize: 12, color: c.pass ? '#2F7A4D' : '#999', margin: '2px 0' }}>
                  {c.pass ? '✓' : '○'} {c.label}
                </p>
              ))}
            </div>
            {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}