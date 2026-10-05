'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'

export default function ProfileForm({ initial, email }: { initial: { name: string; phone: string }; email: string }) {
  const [name, setName] = useState(initial.name)
  const [phone, setPhone] = useState(initial.phone)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  const dirty = name !== initial.name || phone !== initial.phone

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Could not save' })
      else {
        setMsg({ ok: true, text: 'Saved.' })
        router.refresh()
      }
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium text-ink-2">
          Full name
        </label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={`${FIELD} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="phone" className="text-sm font-medium text-ink-2">
          Phone number
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
          aria-describedby="phone-help"
          className={`${FIELD} mt-1.5`}
        />
        <p id="phone-help" className="mt-1.5 text-xs text-ink-3">
          Your driver can call you on this number, and SMS updates go here.
        </p>
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink-2">
          Email
        </label>
        <input id="email" value={email} readOnly aria-describedby="email-help" className={`${FIELD} mt-1.5 bg-canvas text-ink-2`} />
        <p id="email-help" className="mt-1.5 text-xs text-ink-3">
          You sign in with this email. To change it, contact Trashit support.
        </p>
      </div>

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-customer-deep' : 'text-danger'}`}>
          {msg.ok ? <CheckCircle2 aria-hidden className="size-4" /> : <AlertCircle aria-hidden className="size-4" />} {msg.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !dirty} className={BUTTON_PRIMARY}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setName(initial.name)
              setPhone(initial.phone)
              setMsg(null)
            }}
            className={BUTTON_QUIET}
          >
            Discard
          </button>
        )}
      </div>
    </form>
  )
}
