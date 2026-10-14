'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Smartphone } from 'lucide-react'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'

export default function MfaEnrollForm({ onEnrolled, redirectTo }: { onEnrolled?: () => void; redirectTo?: string }) {
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function startEnroll() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not start 2FA setup')
      return
    }

    setQrCode(data.qrCode)
    setSecret(data.secret)
    setFactorId(data.factorId)
    setStarted(true)
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/mfa/enroll/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId, code }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not confirm code')
      return
    }

    setDone(true)
    onEnrolled?.()
    if (redirectTo) {
      setTimeout(() => {
        router.push(redirectTo)
        router.refresh()
      }, 1200)
    }
  }

  const errorLine = error && (
    <p role="alert" className="flex items-start gap-2 text-sm text-danger">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
    </p>
  )

  if (done) {
    return (
      <p role="status" className="anim-note flex items-center gap-3 rounded-[16px] bg-ok-wash p-4 font-semibold text-ok-deep">
        <CheckCircle2 aria-hidden className="size-5" /> Two-step sign-in is on.
      </p>
    )
  }

  if (!started) {
    return (
      <div className="grid gap-3">
        {errorLine}
        <button onClick={startEnroll} disabled={loading} className={`w-full ${BUTTON_PRIMARY}`}>
          <Smartphone aria-hidden className="size-4" /> {loading ? 'Starting…' : 'Set up two-step sign-in'}
        </button>
      </div>
    )
  }

  return (
    <div className="anim-rise grid gap-4">
      <ol className="grid gap-1.5 text-[15px] text-ink-2">
        <li>1. Open Google Authenticator, Authy or a similar app.</li>
        <li>2. Scan this code with it.</li>
        <li>3. Type the 6-digit code it shows.</li>
      </ol>
      <div className="grid place-items-center rounded-[18px] bg-white p-4 ring-1 ring-line [&_svg]:size-44" dangerouslySetInnerHTML={{ __html: qrCode }} />
      <p className="text-xs text-ink-3">
        Can&apos;t scan? Type this key into the app instead: <code className="break-all rounded bg-canvas px-1.5 py-0.5 font-mono text-ink">{secret}</code>
      </p>
      <form onSubmit={confirmCode} className="grid gap-3">
        <label htmlFor="mfa-new-code" className="text-sm font-medium text-ink-2">
          6-digit code
        </label>
        <input
          id="mfa-new-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${FIELD} text-center text-2xl font-semibold tracking-[0.4em] tabular-nums`}
        />
        {errorLine}
        <button type="submit" disabled={loading} className={`w-full ${BUTTON_PRIMARY}`}>
          {loading ? 'Checking…' : 'Turn on two-step sign-in'}
        </button>
      </form>
    </div>
  )
}
