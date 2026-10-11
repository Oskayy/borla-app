'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { Result } from '@/components/ops/kit'

async function post(url: string, body: unknown): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error || 'Could not save' }
  } catch {
    return { ok: false, text: 'Could not reach Trashit. Please try again.' }
  }
}

// Money moved from the bank to the Paystack balance.
export function TopUpForm() {
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="text-sm font-medium text-ink-2">Amount (GHS)</span>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${FIELD} mt-1.5 w-40 tabular-nums`} />
        </label>
        <label className="min-w-0 flex-1 basis-56">
          <span className="text-sm font-medium text-ink-2">Bank or Paystack reference</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. GCB transfer 4471" />
        </label>
        <button
          type="button"
          disabled={busy || !amount || reference.trim().length < 3}
          onClick={async () => {
            if (!confirm(`Record a top-up of GHS ${Number(amount).toFixed(2)} from the bank to the Paystack balance?`)) return
            setBusy(true)
            const r = await post('/api/admin/finance/topup', { amount: Number(amount), reference })
            setBusy(false)
            setMsg(r.ok ? { ok: true, text: 'Top-up recorded.' } : r)
            if (r.ok) {
              setAmount('')
              setReference('')
              router.refresh()
            }
          }}
          className={BUTTON_PRIMARY}
        >
          {busy ? 'Saving…' : 'Record top-up'}
        </button>
      </div>
      <Result msg={msg} />
    </div>
  )
}

// Confirm a Paystack settlement arrived, with the amount the bank shows.
export function ConfirmSettlement({ id, expected }: { id: string; expected: number }) {
  const [received, setReceived] = useState(expected.toFixed(2))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`recv-${id}`}>
        Amount that arrived in the bank (GHS)
      </label>
      <input
        id={`recv-${id}`}
        type="number"
        min="0"
        step="0.01"
        value={received}
        onChange={(e) => setReceived(e.target.value)}
        className={`${FIELD} w-32 tabular-nums`}
      />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const diff = Math.round(Number(received) * 100) - Math.round(expected * 100)
          if (diff !== 0 && !confirm(`That's GHS ${(diff / 100).toFixed(2)} different from what Paystack sent. Record it as a difference to explain?`)) return
          setBusy(true)
          const r = await post(`/api/admin/finance/settlements/${id}`, { received: Number(received) })
          setBusy(false)
          setMsg(r.ok ? null : r)
          if (r.ok) router.refresh()
        }}
        className={BUTTON_QUIET}
      >
        {busy ? 'Saving…' : 'Arrived in the bank'}
      </button>
      <Result msg={msg} />
    </div>
  )
}

// Mark a money check that found differences as looked at.
export function ReviewCheck({ day }: { day: string }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 basis-60">
        <span className="text-sm font-medium text-ink-2">What you found</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Top-up on 12 Oct recorded late" />
      </label>
      <button
        type="button"
        disabled={busy || note.trim().length < 3}
        onClick={async () => {
          setBusy(true)
          const r = await post(`/api/admin/finance/checks/${day}`, { note })
          setBusy(false)
          setMsg(r.ok ? null : r)
          if (r.ok) router.refresh()
        }}
        className={BUTTON_QUIET}
      >
        {busy ? 'Saving…' : 'Mark as checked'}
      </button>
      <Result msg={msg} />
    </div>
  )
}

// What the Paystack balance (or the bank) already held when the ledger started, or at the switch to live.
export function OpeningBalanceForm({ suggestedPaystack }: { suggestedPaystack: number | null }) {
  const [account, setAccount] = useState<'paystack_balance' | 'bank'>('paystack_balance')
  const [amount, setAmount] = useState(suggestedPaystack != null ? suggestedPaystack.toFixed(2) : '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="text-sm font-medium text-ink-2">Where</span>
          <select
            value={account}
            onChange={(e) => {
              const a = e.target.value as 'paystack_balance' | 'bank'
              setAccount(a)
              setAmount(a === 'paystack_balance' && suggestedPaystack != null ? suggestedPaystack.toFixed(2) : '')
            }}
            className={`${FIELD} mt-1.5 w-auto`}
          >
            <option value="paystack_balance">Paystack balance</option>
            <option value="bank">Bank</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-medium text-ink-2">Amount (GHS)</span>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${FIELD} mt-1.5 w-40 tabular-nums`} />
        </label>
        <label className="min-w-0 flex-1 basis-56">
          <span className="text-sm font-medium text-ink-2">What it is</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Paystack test balance when the ledger started" />
        </label>
        <button
          type="button"
          disabled={busy || !amount || Number(amount) === 0 || note.trim().length < 3}
          onClick={async () => {
            const where = account === 'bank' ? 'the bank' : 'the Paystack balance'
            if (!confirm(`Record an opening balance of GHS ${Number(amount).toFixed(2)} for ${where}? It isn't income or a top-up.`)) return
            setBusy(true)
            const r = await post('/api/admin/finance/opening', { account, amount: Number(amount), note })
            setBusy(false)
            setMsg(r.ok ? { ok: true, text: 'Opening balance recorded.' } : r)
            if (r.ok) {
              setNote('')
              router.refresh()
            }
          }}
          className={BUTTON_QUIET}
        >
          {busy ? 'Saving…' : 'Record opening balance'}
        </button>
      </div>
      <Result msg={msg} />
    </div>
  )
}
