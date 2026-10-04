'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordInput from '@/components/PasswordInput'

function checkStrength(password: string) {
  return [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'One number', pass: /[0-9]/.test(password) },
    { label: 'One symbol (e.g. ! @ # $)', pass: /[^A-Za-z0-9]/.test(password) },
  ]
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('CUSTOMER')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const router = useRouter()
  const strengthChecks = checkStrength(password)
  const allPass = strengthChecks.every((c) => c.pass)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allPass) {
      setError('Please meet all password requirements below before continuing')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password, role }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Signup failed')
      return
    }

    if (data.confirmEmail) {
      setCheckEmail(true)
      return
    }
    router.push('/login')
  }

  if (checkEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Check your email</h1>
          <p style={{ fontSize: 14, color: '#444', marginBottom: 12 }}>
            We sent a link to <strong>{email}</strong>. Tap it to confirm your address, then you can start using Trashit.
          </p>
          <p style={{ fontSize: 13, color: '#666' }}>
            Nothing after a few minutes? Check your spam folder, or go to the login page and ask for the email again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Create your Trashit account</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Takes under a minute.</p>
        <form onSubmit={handleSignup}>
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className="input-field"
          />
          <input
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            className="input-field"
          />
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
            autoComplete="new-password"
            className="input-field"
          />

          <div style={{ marginBottom: 16, marginTop: -8 }}>
            {strengthChecks.map((c) => (
              <p key={c.label} style={{ fontSize: 12, color: c.pass ? '#2F7A4D' : '#999', margin: '2px 0' }}>
                {c.pass ? '✓' : '○'} {c.label}
              </p>
            ))}
          </div>

          <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field">
            <option value="CUSTOMER">I&apos;m a customer</option>
            <option value="DRIVER">I&apos;m a driver</option>
          </select>

          {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  )
}