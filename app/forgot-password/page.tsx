'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Reset your password</h1>
        {submitted ? (
          <p style={{ fontSize: 14, color: '#666', marginTop: 12 }}>
            If an account exists for that email, we&apos;ve sent a password reset link. Check your inbox.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input-field"
              />
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
        <Link href="/login" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 13, color: '#666' }}>
          Back to login
        </Link>
      </div>
    </div>
  )
}