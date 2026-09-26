'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DisableMfaButton({ factorId }: { factorId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function disable() {
    if (!confirm('Turn off 2FA for your account?')) return
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/mfa/unenroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not disable 2FA')
      return
    }

    router.refresh()
  }

  return (
    <div>
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button onClick={disable} disabled={loading} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: 8, fontSize: 13 }}>
        {loading ? 'Disabling...' : 'Turn off 2FA'}
      </button>
    </div>
  )
}