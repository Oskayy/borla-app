'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ShieldOff } from 'lucide-react'
import { BUTTON_DANGER } from '@/components/ui'

export default function DisableMfaButton({ factorId }: { factorId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function disable() {
    if (!confirm('Turn off two-step sign-in for your account?')) return
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
      setError(data.error || 'Could not turn off two-step sign-in')
      return
    }

    router.refresh()
  }

  return (
    <div className="grid gap-2">
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <button onClick={disable} disabled={loading} className={`self-start ${BUTTON_DANGER}`}>
        <ShieldOff aria-hidden className="size-4" /> {loading ? 'Turning off…' : 'Turn off two-step sign-in'}
      </button>
    </div>
  )
}
