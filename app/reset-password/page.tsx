'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, Circle } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'
import AuthShell, { AUTH_BUTTON, AUTH_FIELD, ErrorLine } from '@/components/auth/AuthShell'

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
      setError('Choose a password that meets all the rules below it')
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
    // First sign-in with a temporary password: carry on into the app (2FA setup comes next for staff).
    const first = new URLSearchParams(window.location.search).get('first') === '1'
    setTimeout(() => router.push(first ? '/dashboard' : '/login'), 2000)
  }

  return (
    <AuthShell>
      {done ? (
        <div role="status" className="anim-rise">
          <span className="anim-pop grid size-14 place-items-center rounded-full bg-action text-on-action">
            <CheckCircle2 aria-hidden className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Password updated</h1>
          <p className="mt-2 text-[15px] text-ink-2">Taking you on…</p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="mt-2 text-[15px] text-ink-2">Other phones signed in to your account will be signed out.</p>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <div>
              <label htmlFor="new-password" className="text-sm font-medium text-ink-2">
                New password
              </label>
              <div className="mt-1.5">
                <PasswordInput
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  describedBy="reset-rules"
                  invalid={!!error}
                  className={AUTH_FIELD}
                />
              </div>
            </div>
            <ul id="reset-rules" className="-mt-1 grid gap-1 text-xs" aria-label="Password rules">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.pass ? 'font-medium text-ok-deep' : 'text-ink-3'}`}>
                  {c.pass ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : <Circle aria-hidden className="size-3" />}
                  {c.label}
                  <span className="sr-only">{c.pass ? '(done)' : '(not yet)'}</span>
                </li>
              ))}
            </ul>
            <ErrorLine text={error} />
            <button type="submit" disabled={loading} className={AUTH_BUTTON}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
