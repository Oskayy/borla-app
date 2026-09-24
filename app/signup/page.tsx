'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('CUSTOMER')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authId: data.user?.id,
        name,
        phone,
        email,
        role,
      }),
    })

    if (!res.ok) {
      setError('Account created, but profile setup failed. Contact support.')
      setLoading(false)
      return
    }

    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 380, width: '100%' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Create your Borla account</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Takes under a minute.</p>
        <form onSubmit={handleSignup}>
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input-field"
          />
          <input
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="input-field"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="input-field"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-field"
          >
            <option value="CUSTOMER">I'm a customer</option>
            <option value="DRIVER">I'm a driver</option>
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