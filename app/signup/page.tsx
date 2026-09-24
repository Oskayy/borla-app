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

    // 1. Create the login (Supabase Auth)
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Save their profile info to our own User table
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
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Create your Borla account</h1>
      <form onSubmit={handleSignup}>
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        >
          <option value="CUSTOMER">I'm a customer</option>
          <option value="DRIVER">I'm a driver</option>
        </select>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
    </div>
  )
}