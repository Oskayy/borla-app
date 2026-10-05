'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'
import AuthShell, { AUTH_BUTTON, AUTH_FIELD, AuthTabs, ErrorLine } from '@/components/auth/AuthShell'
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

  const field = AUTH_FIELD
  const shownError = error || linkError

  return (
    <AuthShell agreeVerb="signing in">
      {mfaStep ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Enter your 2FA code</h1>
          <p className="mt-2 text-[15px] text-ink-2">Open your authenticator app and enter the 6-digit code for Trashit.</p>
          <form onSubmit={handleVerifyCode} className="mt-7">
            <label htmlFor="mfa-code" className="text-sm font-medium text-ink-2">
              6-digit code
            </label>
            <input
              id="mfa-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${field} mt-1.5 text-center text-2xl tracking-[0.4em] tabular-nums`}
            />
            <ErrorLine text={shownError} />
            <button
              type="submit"
              disabled={loading}
              className={`mt-5 ${AUTH_BUTTON}`}
            >
              {loading ? 'Checking…' : 'Verify and continue'}
            </button>
          </form>
        </>
      ) : (
        <>
          <AuthTabs current="signin" />
          <h1 className="mt-7 text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-[15px] text-ink-2">Sign in to your pickups or your night&apos;s stops.</p>
          {notice && (
            <p role="status" className="mt-5 flex items-start gap-2 rounded-control bg-customer-wash px-3.5 py-3 text-sm text-customer-deep">
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> {notice}
            </p>
          )}
          <form onSubmit={handleLogin} className="mt-6 grid gap-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-ink-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={`${field} mt-1.5`}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className="text-sm font-medium text-ink-2">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-ops-deep hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="mt-1.5">
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={field}
                />
              </div>
            </div>
            <ErrorLine text={shownError} />
            {notConfirmed && (
              <p className="-mt-2 text-sm" aria-live="polite">
                {resent ? (
                  <span className="text-customer-deep">If that email needs confirming, a new link is on its way.</span>
                ) : (
                  <button type="button" onClick={resendConfirmation} className="font-medium text-ops-deep underline underline-offset-2">
                    Send the confirmation email again
                  </button>
                )}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className={AUTH_BUTTON}
            >
              {loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight aria-hidden className="size-4" />}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}

