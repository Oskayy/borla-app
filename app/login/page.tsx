'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [mfaStep, setMfaStep] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')

  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      if (data.mfaRequired) {
        setFactorId(data.factorId)
        setMfaStep(true)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      })
      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'Verification failed')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (mfaStep) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Enter your 2FA code</h1>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
            Open your authenticator app and enter the 6-digit code.
          </p>
          <form onSubmit={handleVerifyCode}>
            <input
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input-field"
              style={{ letterSpacing: 4, fontSize: 20, textAlign: 'center' }}
            />
            {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Log in to Borla</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Pickups, on schedule.</p>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input-field"
          />
          {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <Link href="/forgot-password" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 13, color: '#666' }}>
          Forgot your password?
        </Link>
      </div>
    </div>
  )
}