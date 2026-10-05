'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import PasswordInput from '@/components/PasswordInput'
import { FIELD } from '@/components/ui'

// Deletes the customer's account after a password check and typing DELETE (rules in the API route).
export default function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function remove(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not delete your account')
        setBusy(false)
        return
      }
      await createClient().auth.signOut({ scope: 'local' }).catch(() => {})
      router.push('/?account=deleted')
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Nothing was changed. Please try again.')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-[15px] font-semibold text-danger ring-1 ring-danger/40 transition hover:bg-danger-wash"
      >
        <Trash2 aria-hidden className="size-4" /> Delete my account
      </button>
    )
  }

  return (
    <form onSubmit={remove} className="grid gap-4 rounded-card bg-danger-wash p-5">
      <p className="flex items-start gap-2.5 text-[15px] text-ink">
        <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
        <span>
          This can&apos;t be undone. Your login, name, phone, email, home pin and your waste photos are deleted. Records of past
          payments are kept for accounting, without your personal details.
        </span>
      </p>
      <div>
        <label htmlFor="delete-password" className="text-sm font-medium text-ink-2">
          Your password
        </label>
        <div className="mt-1.5">
          <PasswordInput id="delete-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={FIELD} />
        </div>
      </div>
      <div className="-mt-3">
        <label htmlFor="delete-confirm" className="text-sm font-medium text-ink-2">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className={`${FIELD} mt-1.5`}
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || confirm !== 'DELETE' || !password}
          className="inline-flex min-h-11 items-center rounded-control bg-danger px-4 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setPassword('')
            setConfirm('')
            setError('')
          }}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 text-[15px] font-semibold text-ink ring-1 ring-line-strong"
        >
          Keep my account
        </button>
      </div>
    </form>
  )
}
