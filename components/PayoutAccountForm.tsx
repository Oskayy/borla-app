'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PayoutAccountForm({
  initial,
  providers,
  locked,
}: {
  initial: { momoNumber: string; momoProvider: string; momoName: string }
  providers: { code: string; name: string }[]
  locked: boolean // a withdrawal is in progress
}) {
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/driver/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error || 'Could not save' })
      if (res.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label style={{ fontSize: 12, color: '#666' }}>Network</label>
      <select
        value={values.momoProvider}
        onChange={(e) => setValues((v) => ({ ...v, momoProvider: e.target.value }))}
        className="input-field"
        disabled={locked}
      >
        {providers.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name}
          </option>
        ))}
      </select>
      <label style={{ fontSize: 12, color: '#666' }}>MoMo number</label>
      <input
        value={values.momoNumber}
        onChange={(e) => setValues((v) => ({ ...v, momoNumber: e.target.value }))}
        className="input-field"
        inputMode="tel"
        placeholder="e.g. 024 412 3456"
        disabled={locked}
      />
      <label style={{ fontSize: 12, color: '#666' }}>Name on the wallet</label>
      <input
        value={values.momoName}
        onChange={(e) => setValues((v) => ({ ...v, momoName: e.target.value }))}
        className="input-field"
        placeholder="As registered with the network"
        disabled={locked}
      />
      {locked ? (
        <p style={{ fontSize: 12, color: '#666' }}>You can change your wallet once your current withdrawal is finished.</p>
      ) : (
        <button onClick={save} disabled={busy} className="btn-primary" style={{ width: '100%' }}>
          {busy ? 'Saving...' : 'Save wallet'}
        </button>
      )}
      {msg && <p style={{ fontSize: 13, marginTop: 6, color: msg.ok ? '#2F7A4D' : '#B3261E' }}>{msg.text}</p>}
    </div>
  )
}
