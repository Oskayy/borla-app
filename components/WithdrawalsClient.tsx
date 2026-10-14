'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, RefreshCw, Send } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { AllClear, Chip, PANEL, Result, SectionTitle, type Tone } from '@/components/ops/kit'
import { dateLabel, dateTimeLabel } from '@/lib/format'

export interface WithdrawalRow {
  id: string
  driverName: string
  driverPhone: string
  amount: number
  status: string
  momo: string
  note: string | null
  method: string | null
  requestedAt: string
  paidAt: string | null
  totalEarned: number | null
  markedByMe: boolean // this user recorded the manual payment, so someone else must confirm it
  source: string // request | cashout | sweep
  fee: number // GHS the driver pays for the transfer (extra cash-outs), taken from the amount
}


const SOURCE: Record<string, string> = { request: 'Requested', cashout: 'Cash out now', sweep: 'Daily payout' }

export default function WithdrawalsClient({ open, recent, transfersOn = true }: { open: WithdrawalRow[]; recent: WithdrawalRow[]; transfersOn?: boolean }) {
  const [active, setActive] = useState<{ id: string; action: 'mark_paid' | 'reject' | 'dispute_paid' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const router = useRouter()

  async function act(id: string, action: 'send' | 'mark_paid' | 'reject' | 'check' | 'confirm_paid' | 'dispute_paid') {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: action === 'send' || action === 'check' || action === 'confirm_paid' ? undefined : note }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg((m) => ({
        ...m,
        [id]: res.ok
          ? {
              ok: true,
              text:
                data.status === 'PAID'
                  ? 'Paid.'
                  : data.status === 'CONFIRMING'
                  ? 'Recorded. A second finance team member must now confirm the payment.'
                  : data.status === 'FAILED'
                  ? 'The transfer failed; the money is back in the driver’s balance.'
                  : data.status === 'REQUESTED'
                  ? 'Paystack never received it. Safe to send again.'
                  : data.paystackStatus === 'otp'
                  ? 'Waiting for OTP in Paystack.'
                  : data.paystackStatus === 'unknown'
                  ? 'No answer from Paystack yet. Press Check in a few minutes.'
                  : 'Sent to Paystack. It will show as Paid when confirmed.',
            }
          : { ok: false, text: data.error || 'Could not save' },
      }))
      if (res.ok) {
        setActive(null)
        setNote('')
        router.refresh()
      }
    } catch {
      setMsg((m) => ({ ...m, [id]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(null)
    }
  }

  const recentState = (s: string): { text: string; tone: Tone } =>
    s === 'PAID' ? { text: 'Paid', tone: 'ops' } : s === 'FAILED' ? { text: 'Failed', tone: 'danger' } : s === 'REJECTED' ? { text: 'Rejected', tone: 'danger' } : { text: s, tone: 'neutral' }

  return (
    <div className="grid gap-10">
      <section aria-labelledby="h-waiting">
        <SectionTitle id="h-waiting" count={open.length}>
          Waiting
        </SectionTitle>
        {open.length === 0 && <AllClear>No withdrawals waiting.</AllClear>}
        <ul className="grid gap-3 empty:hidden">
          {open.map((w) => (
            <li key={w.id} className={PANEL}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="text-2xl font-bold tabular-nums tracking-tight">GHS {w.amount.toFixed(2)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
                    <span className="font-semibold">{w.driverName}</span>
                    {w.driverPhone && (
                      <a href={`tel:${w.driverPhone}`} className="inline-flex items-center gap-1 text-sm font-medium text-action-deep hover:underline">
                        <Phone aria-hidden className="size-3.5" /> {w.driverPhone}
                      </a>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-ink-2">
                    {SOURCE[w.source] ?? 'Requested'} · to {w.momo}
                    {w.fee > 0 && <span className="tabular-nums"> · GHS {(w.amount - w.fee).toFixed(2)} sent after the GHS {w.fee.toFixed(2)} fee</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-3">
                    Asked {dateTimeLabel(w.requestedAt)}
                    {w.totalEarned != null && <span className="tabular-nums"> · earned GHS {w.totalEarned.toFixed(2)} in total</span>}
                  </p>
                  {w.note && w.status !== 'CONFIRMING' && <p className="mt-2 rounded-control bg-danger-wash p-2.5 text-sm text-ink">{w.note}</p>}
                </div>

                {w.status === 'REQUESTED' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => confirm(`Send GHS ${w.amount.toFixed(2)} to ${w.driverName} on ${w.momo} through Paystack? This can't be undone.`) && act(w.id, 'send')}
                      disabled={busy === w.id || !transfersOn}
                      title={transfersOn ? undefined : 'Paystack transfers are off (Finance page): pay by hand and use Mark paid'}
                      className={BUTTON_PRIMARY}
                    >
                      <Send aria-hidden className="size-4" /> {busy === w.id ? 'Sending…' : `Send GHS ${w.amount.toFixed(2)}`}
                    </button>
                    <button type="button" className={BUTTON_QUIET} onClick={() => { setActive({ id: w.id, action: 'mark_paid' }); setNote('') }}>
                      Mark paid
                    </button>
                    <button type="button" className={BUTTON_DANGER} onClick={() => { setActive({ id: w.id, action: 'reject' }); setNote('') }}>
                      Reject
                    </button>
                  </div>
                ) : w.status === 'CONFIRMING' ? (
                  <div className="grid max-w-sm justify-items-start gap-2">
                    <Chip tone={w.markedByMe ? 'driver' : 'danger'}>{w.markedByMe ? 'Waiting for a colleague to confirm' : 'Please check and confirm'}</Chip>
                    <p className="text-sm text-ink-2">
                      Paid by hand, reference <span className="font-medium text-ink">{w.note}</span>
                    </p>
                    {!w.markedByMe && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => confirm(`You checked and GHS ${w.amount.toFixed(2)} reached ${w.momo}? This marks the withdrawal paid.`) && act(w.id, 'confirm_paid')}
                          disabled={busy === w.id}
                          className={BUTTON_PRIMARY}
                        >
                          {busy === w.id ? 'Saving…' : `GHS ${w.amount.toFixed(2)} is there: confirm`}
                        </button>
                        <button type="button" className={BUTTON_DANGER} onClick={() => { setActive({ id: w.id, action: 'dispute_paid' }); setNote('') }}>
                          Can&apos;t find it
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip>Being sent</Chip>
                    {w.method === 'paystack' && (
                      <button type="button" className={BUTTON_QUIET} disabled={busy === w.id} onClick={() => act(w.id, 'check')}>
                        <RefreshCw aria-hidden className="size-4" /> {busy === w.id ? 'Checking…' : 'Check with Paystack'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {active?.id === w.id && (
                <div className="mt-4 border-t border-line pt-4">
                  <label className="block">
                    <span className="text-sm font-medium text-ink-2">
                      {active.action === 'mark_paid'
                        ? 'MoMo transaction ID of your payment'
                        : active.action === 'dispute_paid'
                        ? 'What you found (kept in the record)'
                        : 'Reason (the driver sees this)'}
                    </span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} mt-1.5`} />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        active.action === 'mark_paid'
                          ? confirm(`Record that you paid GHS ${w.amount.toFixed(2)} to ${w.momo} by hand? A colleague then confirms it.`) && act(w.id, active.action)
                          : act(w.id, active.action)
                      }
                      disabled={busy === w.id || note.trim().length < 3}
                      className={active.action === 'mark_paid' ? BUTTON_PRIMARY : BUTTON_DANGER}
                    >
                      {active.action === 'mark_paid' ? `Record GHS ${w.amount.toFixed(2)} paid` : active.action === 'dispute_paid' ? 'Send back' : 'Confirm reject'}
                    </button>
                    <button type="button" className={BUTTON_QUIET} onClick={() => setActive(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <Result msg={msg[w.id]} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-recent">
        <SectionTitle id="h-recent">Recent</SectionTitle>
        {recent.length === 0 ? (
          <AllClear>No finished withdrawals yet.</AllClear>
        ) : (
          <ul className="divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {recent.map((w) => {
              const st = recentState(w.status)
              return (
                <li key={w.id} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      <span className="tabular-nums">GHS {w.amount.toFixed(2)}</span> · {w.driverName}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {w.momo} · {dateLabel(w.requestedAt)}
                      {w.method && ` · ${w.method === 'manual' ? 'paid by hand' : 'Paystack'}`}
                      {w.note && ` · ${w.note}`}
                    </p>
                  </div>
                  <Chip tone={st.tone}>{st.text}</Chip>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
