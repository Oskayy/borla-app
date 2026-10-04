'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

  const btn = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 10px', fontSize: 13, cursor: 'pointer' } as const

  return (
    <div>
      {secret && (
        <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid var(--color-accent)', background: '#FFF6E5' }}>
          <p style={{ fontWeight: 600 }}>Temporary password for {secret.who}</p>
          <p style={{ fontFamily: 'monospace', fontSize: 18, margin: '6px 0', userSelect: 'all' }}>{secret.password}</p>
          <p style={{ fontSize: 12, color: '#666' }}>
            Shown only once. Pass it on in person or by phone, not by email or chat. They&apos;ll choose their own password at first
            sign-in.
          </p>
          <button style={{ ...btn, marginTop: 6 }} onClick={() => setSecret(null)}>
            I&apos;ve passed it on
          </button>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Add a staff member</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          <input className="input-field" style={{ marginBottom: 0 }} placeholder="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input-field" style={{ marginBottom: 0 }} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input-field" style={{ marginBottom: 0 }} placeholder="Phone" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <select className="input-field" style={{ marginBottom: 0 }} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p style={{ color: '#B3261E', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button onClick={create} disabled={creating} className="btn-accent" style={{ marginTop: 10 }}>
          {creating ? 'Creating...' : 'Create account'}
        </button>
      </div>

      {rows.map((r) => (
        <div key={r.id} className="panel" style={{ marginBottom: 8, opacity: r.active ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 600 }}>
                {r.name} {r.isMe && <span style={{ fontSize: 12, color: '#666' }}>(you)</span>}
                {!r.active && <span style={{ fontSize: 12, color: '#B3261E' }}> · SUSPENDED</span>}
                {r.mustChangePassword && r.active && <span style={{ fontSize: 12, color: '#9A6415' }}> · hasn&apos;t signed in yet</span>}
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>
                {r.email} · {r.phone} · added {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
            {r.isMe ? (
              <span style={{ fontSize: 13 }}>{roles.find((x) => x.code === r.role)?.label ?? r.role}</span>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={r.role}
                  disabled={busy === r.id}
                  onChange={(e) => update(r, { role: e.target.value })}
                  className="input-field"
                  style={{ marginBottom: 0, width: 'auto', fontSize: 13 }}
                >
                  {roles.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.code.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <button style={btn} disabled={busy === r.id} onClick={() => update(r, { resetPassword: true })}>
                  New temp password
                </button>
                <button
                  style={{ ...btn, color: r.active ? '#B3261E' : '#2F7A4D', borderColor: r.active ? '#B3261E' : '#2F7A4D' }}
                  disabled={busy === r.id}
                  onClick={() => update(r, { active: !r.active })}
                >
                  {r.active ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            )}
          </div>
          {msg[r.id] && <p style={{ fontSize: 13, marginTop: 6, color: msg[r.id].ok ? '#2F7A4D' : '#B3261E' }}>{msg[r.id].text}</p>}
        </div>
      ))}
    </div>
  )
}
