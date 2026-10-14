'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MailCheck } from 'lucide-react'
import AuthShell, { AUTH_BUTTON, AUTH_FIELD } from '@/components/auth/AuthShell'
import { BackLink } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <AuthShell>
      <BackLink href="/login">Back to sign in</BackLink>
      {submitted ? (
        <div role="status" className="anim-rise">
          <span className="anim-pop grid size-14 place-items-center rounded-full bg-action text-on-action">
            <MailCheck aria-hidden className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            If an account exists for <span className="font-semibold text-ink">{email}</span>, we&apos;ve sent a link to choose a new password.
          </p>
          <Link href="/login" className={`mt-7 ${AUTH_BUTTON}`}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-[15px] text-ink-2">Enter your email and we&apos;ll send you a link to choose a new one.</p>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
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
                className={`${AUTH_FIELD} mt-1.5`}
              />
            </div>
            <button type="submit" disabled={loading} className={AUTH_BUTTON}>
              {loading ? 'Sending…' : 'Send reset link'} {!loading && <ArrowRight aria-hidden className="size-4" />}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
