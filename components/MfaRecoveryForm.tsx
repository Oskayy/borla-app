'use client'

import { useState } from 'react'
import { BUTTON_DANGER, FIELD } from '@/components/ui'
import { PANEL, Result } from '@/components/ops/kit'

export default function MfaRecoveryForm() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mfa-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not reset 2FA' })
        return
      }
      setMsg({ ok: true, text: `2FA reset for ${email}. They set it up again at their next sign-in.` })
      setEmail('')
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <label className="block">
        <span className="text-sm font-medium text-ink-2">The person&apos;s email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. driver@example.com" />
      </label>
      <Result msg={msg} />
      <button type="submit" disabled={loading || !email} className={`${BUTTON_DANGER} mt-4 w-full sm:w-auto`}>
        {loading ? 'Resetting…' : 'Reset 2FA for this person'}
      </button>
    </form>
  )
}
