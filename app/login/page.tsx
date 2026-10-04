'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PasswordInput from '@/components/PasswordInput'
import { useClientValue } from '@/lib/use-client-value'

const LINK_ERRORS: Record<string, string> = {
  'confirm-link-invalid': 'That confirmation link has expired or was already used. Log in, or ask for a new link.',
  'reset-link-invalid': 'That password reset link has expired or was already used. Please ask for a new one.',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notConfirmed, setNotConfirmed] = useState(false)
  const [resent, setResent] = useState(false)

  // Messages from email links (?confirmed=1 after confirming, ?error=... for expired links).
  // The link's error shows until the first login attempt, like any other error.
  const linkParams = new URLSearchParams(useClientValue(() => window.location.search, ''))
  const notice = linkParams.get('confirmed') === '1' ? 'Your email is confirmed. Please log in.' : ''
  const [attempted, setAttempted] = useState(false)
  const linkError = attempted ? '' : LINK_ERRORS[linkParams.get('error') ?? ''] ?? ''

  async function resendConfirmation() {
    setResent(false)
    await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {})
    setResent(true)
  }

  const [mfaStep, setMfaStep] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')

  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    setError('')
    setNotConfirmed(false)
    setResent(false)
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
        setNotConfirmed(data.notConfirmed === true)
        return
      }

      if (data.mfaRequired) {
        setFactorId(data.factorId)
        setMfaStep(true)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
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
    } catch {
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
            {(error || linkError) && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error || linkError}</p>}
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
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Log in to Trashit</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Pickups, on schedule.</p>
        {notice && <p style={{ color: '#2F7A4D', fontSize: 13, marginBottom: 12 }}>{notice}</p>}
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
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input-field"
          />
          {(error || linkError) && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error || linkError}</p>}
          {notConfirmed && (
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              {resent ? (
                <span style={{ color: '#2F7A4D' }}>If that email needs confirming, a new link is on its way.</span>
              ) : (
                <button type="button" onClick={resendConfirmation} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
                  Send the confirmation email again
                </button>
              )}
            </p>
          )}
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