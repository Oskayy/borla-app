'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import InfoTip from '@/components/InfoTip'

// Name, phone and email for customers and drivers. Changing the email asks for the current password.
export default function ProfileForm({
  initial,
  email: initialEmail,
  phoneHint = 'Your driver can call you on this number, and SMS updates go here.',
}: {
  initial: { name: string; phone: string }
  email: string
  phoneHint?: string
}) {
  const [name, setName] = useState(initial.name)
  const [phone, setPhone] = useState(initial.phone)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  const emailChanged = email.trim().toLowerCase() !== initialEmail.toLowerCase()
  const dirty = name !== initial.name || phone !== initial.phone || emailChanged

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email: email.trim(), password: emailChanged ? password : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Could not save' })
      else {
        setPassword('')
        setMsg({
          ok: true,
          text: data.emailPending ? `Saved. We sent a link to ${email.trim()}: open it to finish changing your email.` : 'Saved.',
        })
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
        <label htmlFor="phone" className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
          Phone number <InfoTip text={phoneHint} />
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
          className={`${FIELD} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
          Email <InfoTip text="You sign in with this email." />
        </label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={`${FIELD} mt-1.5`} />
      </div>
      {emailChanged && (
        <div>
          <label htmlFor="current-password" className="text-sm font-medium text-ink-2">
            Your password, to change your email
          </label>
          <input
            id="current-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={`${FIELD} mt-1.5`}
          />
        </div>
      )}

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-action-deep' : 'text-danger'}`}>
          {msg.ok ? <CheckCircle2 aria-hidden className="size-4 shrink-0" /> : <AlertCircle aria-hidden className="size-4 shrink-0" />} {msg.text}
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
              setEmail(initialEmail)
              setPassword('')
              setMsg(null)
            }}
            className={BUTTON_QUIET}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
