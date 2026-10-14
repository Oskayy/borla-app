'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, UserPlus } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { Chip, PANEL, Result, SELECT, SectionTitle } from '@/components/ops/kit'
import { dateLabel } from '@/lib/format'

export interface StaffRow {
  id: string
  name: string
  email: string | null
  phone: string
  role: string
  active: boolean
  mustChangePassword: boolean
  createdAt: string
  isMe: boolean
}

export default function StaffClient({ rows, roles }: { rows: StaffRow[]; roles: { code: string; label: string }[] }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'DISPATCHER' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [secret, setSecret] = useState<{ who: string; password: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function create() {
    setCreating(true)
    setError('')
    setSecret(null)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not create the account')
        return
      }
      setSecret({ who: `${form.name} (${form.email})`, password: data.temporaryPassword })
      setForm({ name: '', email: '', phone: '', role: 'DISPATCHER' })
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function update(row: StaffRow, change: { role?: string; active?: boolean; resetPassword?: true }) {
    if (change.active === false && !confirm(`Suspend ${row.name}? They will be signed out and can't sign in until reactivated.`)) return
    setBusy(row.id)
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg((m) => ({ ...m, [row.id]: { ok: false, text: data.error || 'Could not save' } }))
        return
      }
      if (data.temporaryPassword) setSecret({ who: `${row.name} (${row.email ?? row.phone})`, password: data.temporaryPassword })
      setMsg((m) => ({ ...m, [row.id]: { ok: true, text: 'Saved.' } }))
      router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [row.id]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  // "Ops Manager (dispatch, settings, refunds)" -> "Ops Manager" for the compact role lists.
  const short = (code: string) => (roles.find((x) => x.code === code)?.label ?? code).split(' (')[0]

  return (
    <div className="grid gap-8">
      {secret && (
        <div role="alert" className="rounded-card bg-action-wash p-5 ring-1 ring-action-deep/30">
          <p className="flex items-center gap-2 font-semibold">
            <KeyRound aria-hidden className="size-4 text-action-deep" /> Temporary password for {secret.who}
          </p>
          <p className="my-3 select-all rounded-control bg-surface px-4 py-3 font-mono text-lg tracking-wide ring-1 ring-line">{secret.password}</p>
          <p className="text-sm text-ink-2">
            Shown only once. Pass it on in person or by phone, not by email or chat. They choose their own password at first sign-in.
          </p>
          <button type="button" className={`${BUTTON_QUIET} mt-3`} onClick={() => setSecret(null)}>
            I&apos;ve passed it on
          </button>
        </div>
      )}

      <section aria-labelledby="h-add" className={PANEL}>
        <h2 id="h-add" className="text-base font-semibold tracking-tight">
          Add a staff member
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Full name</span>
            <input className={`${FIELD} mt-1.5`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Email</span>
            <input className={`${FIELD} mt-1.5`} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Phone</span>
            <input className={`${FIELD} mt-1.5`} inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-2">What they can do</span>
            <select className={`${FIELD} mt-1.5`} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Result msg={error ? { ok: false, text: error } : null} />
        <button type="button" onClick={create} disabled={creating} className={`${BUTTON_PRIMARY} mt-4`}>
          <UserPlus aria-hidden className="size-4" /> {creating ? 'Creating…' : 'Create account'}
        </button>
      </section>

      <section aria-labelledby="h-staff">
        <SectionTitle id="h-staff" count={rows.length}>
          Staff
        </SectionTitle>
        <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {rows.map((r) => (
            <li key={r.id} className={`p-4 sm:px-5 ${r.active ? '' : 'bg-canvas/60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    {r.isMe && <Chip>You</Chip>}
                    {!r.active && <Chip tone="danger">Suspended</Chip>}
                    {r.mustChangePassword && r.active && <Chip>Hasn&apos;t signed in yet</Chip>}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-3">
                    {r.email} · {r.phone} · added {dateLabel(r.createdAt)}
                  </p>
                </div>
                {r.isMe ? (
                  <span className="text-sm font-medium text-ink-2">{short(r.role)}</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={r.role}
                      disabled={busy === r.id}
                      onChange={(e) => update(r, { role: e.target.value })}
                      className={SELECT}
                      aria-label={`What ${r.name} can do`}
                    >
                      {roles.map((x) => (
                        <option key={x.code} value={x.code}>
                          {short(x.code)}
                        </option>
                      ))}
                    </select>
                    <button type="button" className={BUTTON_QUIET} disabled={busy === r.id} onClick={() => update(r, { resetPassword: true })}>
                      New temporary password
                    </button>
                    <button
                      type="button"
                      className={r.active ? BUTTON_DANGER : BUTTON_QUIET}
                      disabled={busy === r.id}
                      onClick={() => update(r, { active: !r.active })}
                    >
                      {r.active ? 'Suspend' : 'Reactivate'}
                    </button>
                  </div>
                )}
              </div>
              <Result msg={msg[r.id]} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
