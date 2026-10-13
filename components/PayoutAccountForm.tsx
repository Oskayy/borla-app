'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'

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
  const [password, setPassword] = useState('')
  const changed =
    values.momoNumber !== initial.momoNumber || values.momoProvider !== initial.momoProvider || values.momoName !== initial.momoName
  // Only replacing a saved wallet starts the 24-hour pause; the first one works straight away.
  const replacing = !!initial.momoNumber
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
        body: JSON.stringify({ ...values, password }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg(
        res.ok
          ? { ok: true, text: data.holdHours ? `Saved. For your safety, withdrawals are paused for ${data.holdHours} hours.` : 'Saved.' }
          : { ok: false, text: data.error || 'Could not save' }
      )
      setPassword('')
      if (res.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const label = 'text-sm font-medium text-ink-2'
  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor="momo-network" className={label}>
          Network
        </label>
        <select
          id="momo-network"
          value={values.momoProvider}
          onChange={(e) => setValues((v) => ({ ...v, momoProvider: e.target.value }))}
          className={`${FIELD} mt-1.5`}
          disabled={locked}
        >
          {providers.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="momo-number" className={label}>
          MoMo number
        </label>
        <input
          id="momo-number"
          aria-describedby={msg && !msg.ok ? 'payout-msg' : undefined}
          aria-invalid={msg && !msg.ok ? true : undefined}
          value={values.momoNumber}
          onChange={(e) => setValues((v) => ({ ...v, momoNumber: e.target.value }))}
          className={`${FIELD} mt-1.5`}
          inputMode="tel"
          placeholder="e.g. 024 412 3456"
          disabled={locked}
        />
      </div>
      <div>
        <label htmlFor="momo-name" className={label}>
          Name on the wallet
        </label>
        <input
          id="momo-name"
          value={values.momoName}
          onChange={(e) => setValues((v) => ({ ...v, momoName: e.target.value }))}
          className={`${FIELD} mt-1.5`}
          placeholder="As registered with the network"
          disabled={locked}
        />
      </div>
      {!locked && changed && (
        <div className="grid gap-2 rounded-control bg-canvas p-4 ring-1 ring-line">
          <label htmlFor="payout-password" className={label}>
            Your Trashit password (to confirm it&apos;s you)
          </label>
          <input
            id="payout-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={[replacing ? 'payout-hold' : '', msg && !msg.ok ? 'payout-msg' : ''].filter(Boolean).join(' ') || undefined}
            className={FIELD}
          />
          {replacing && (
            <p id="payout-hold" className="flex items-start gap-2 text-sm text-driver-deep">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              Changing your wallet pauses withdrawals for 24 hours, and we&apos;ll alert you about the change.
            </p>
          )}
        </div>
      )}
      {locked ? (
        <p className="text-sm text-ink-3">You can change your wallet once your current withdrawal is finished.</p>
      ) : (
        <button onClick={save} disabled={busy || !changed || !password} className={`w-full min-h-12 ${BUTTON_PRIMARY}`}>
          {busy ? 'Saving…' : 'Save wallet'}
        </button>
      )}
      {msg && (
        <p id="payout-msg" role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-customer-deep' : 'text-danger'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
