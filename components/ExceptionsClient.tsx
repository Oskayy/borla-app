'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, CreditCard, MapPinOff, Phone, Undo2 } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { dateTimeLabel } from '@/lib/format'
import { attemptFeeBps } from '@/lib/money-split'

export interface ExceptionItem {
  kind: 'flagged' | 'payment' | 'gps'
  orderId: string
  status: string
  address: string
  price: number | null
  customerName: string
  customerPhone: string
  driverName: string | null
  reason: string
  updatedAt: string
  payments: { id: string; amount: number; status: string; refundable: number }[]
}

export interface RefundRow {
  id: string
  orderId: string
  address: string
  customerName: string
  amount: number
  status: string
  reason: string
  createdAt: string
  requestedByMe: boolean // this user asked for it, so someone else must approve it
}

const SECTIONS: Record<ExceptionItem['kind'], { title: string; hint: string; icon: typeof AlertTriangle }> = {
  flagged: { title: 'Failed pickups and disputes', hint: 'The driver couldn’t collect, or the customer disputes it.', icon: AlertTriangle },
  payment: { title: 'Payment problems', hint: 'The amount paid didn’t match the price, or a payment arrived twice or late.', icon: CreditCard },
  gps: {
    title: 'Pickup checks',
    hint: 'Collected and paid, but the location or photo looked off. Worth a look; nothing is blocked.',
    icon: MapPinOff,
  },
}

// Order statuses in words people use.
const ORDER_STATUS: Record<string, string> = {
  FAILED_PICKUP: 'Failed pickup',
  DISPUTED: 'Disputed',
  PAID: 'Paid, waiting for a driver',
  ASSIGNED: 'With a driver',
  PICKED_UP: 'Collected',
  DISPOSAL_PENDING: 'Collected, unload not confirmed',
  DISPOSAL_VERIFIED: 'Unloaded',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
}

function refundState(r: RefundRow): { text: string; cls: string } {
  switch (r.status) {
    case 'PROCESSED':
      return { text: 'Refunded', cls: 'bg-action-wash text-action-deep' }
    case 'PENDING':
    case 'PROCESSING':
      return { text: 'Being sent', cls: 'bg-canvas text-ink-2 ring-1 ring-line' }
    case 'NEEDS_ATTENTION':
      return { text: 'Check Paystack', cls: 'bg-danger-wash text-danger' }
    case 'AWAITING_APPROVAL':
      return r.requestedByMe
        ? { text: 'Waiting for a colleague', cls: 'bg-canvas text-ink-2 ring-1 ring-line' }
        : { text: 'Needs your approval', cls: 'bg-danger-wash text-danger' }
    case 'FAILED':
      return { text: 'Failed', cls: 'bg-danger-wash text-danger' }
    default:
      return { text: r.status, cls: 'bg-canvas text-ink-2' }
  }
}

// Payment statuses in plain words ('success' just means paid, so it isn't repeated).
const PAYMENT_STATE: Record<string, string> = { success: '', partially_refunded: 'part refunded', refunded: 'refunded', failed: 'failed', pending: 'not finished' }
const ERROR_LINE = 'mt-2 text-sm text-danger empty:hidden'

function ApproveRefund({ id, amount }: { id: string; amount: number }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  async function decide(outcome: 'approve' | 'decline') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not save')
      else router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-end gap-2.5">
        <button
          type="button"
          className={BUTTON_PRIMARY}
          disabled={busy}
          onClick={() => confirm(`Approve and send a refund of GHS ${amount.toFixed(2)} through Paystack?`) && decide('approve')}
        >
          {busy ? 'Saving…' : `Approve and send GHS ${amount.toFixed(2)}`}
        </button>
        <label className="min-w-56 flex-1">
          <span className="sr-only">Reason, to decline</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} placeholder="Reason, to decline" />
        </label>
        <button type="button" className={BUTTON_DANGER} disabled={busy || note.trim().length < 3} onClick={() => decide('decline')}>
          Decline
        </button>
      </div>
      <p aria-live="polite" className={ERROR_LINE}>
        {error}
      </p>
    </div>
  )
}

function SettleRefund({ id }: { id: string }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  async function settle(outcome: 'processed' | 'failed') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not save')
      else router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 border-t border-line pt-4">
      <label className="block">
        <span className="text-sm font-medium text-ink-2">What the Paystack dashboard shows (required)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Refund RF_123 processed on 4 Oct" />
      </label>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <button type="button" className={BUTTON_QUIET} disabled={busy || note.trim().length < 3} onClick={() => settle('processed')}>
          Paystack shows it was refunded
        </button>
        <button type="button" className={BUTTON_QUIET} disabled={busy || note.trim().length < 3} onClick={() => settle('failed')}>
          No refund in Paystack: release it
        </button>
      </div>
      <p aria-live="polite" className={ERROR_LINE}>
        {error}
      </p>
    </div>
  )
}

// The attempt fee for a failed pickup that was the customer's fault (same sums as the server, lib/money-split.ts).
function attemptPreview(price: number, percent: number) {
  const p = Math.round(price * 100)
  const fee = Math.floor((p * attemptFeeBps(percent)) / 10_000)
  return { fee: fee / 100, refund: (p - fee) / 100 }
}

export default function ExceptionsClient({
  items,
  refunds,
  canRefund,
  attemptFeePercent,
}: {
  items: ExceptionItem[]
  refunds: RefundRow[]
  canRefund: boolean
  attemptFeePercent: number
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [mode, setMode] = useState<'retry' | 'close' | 'refund' | 'review' | 'attempt_fee'>('retry')
  const [driverFault, setDriverFault] = useState(false)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [cancelToo, setCancelToo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const [filter, setFilter] = useState<'all' | ExceptionItem['kind']>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const router = useRouter()

  function start(item: ExceptionItem, m: typeof mode) {
    const key = `${item.kind}-${item.orderId}`
    setOpen(key)
    setMode(m)
    setNote('')
    const pay = item.kind === 'payment' ? item.payments[item.payments.length - 1] : item.payments.find((p) => p.refundable > 0)
    setPaymentId(pay?.id ?? '')
    setAmount(pay ? pay.refundable.toFixed(2) : '')
    setCancelToo(item.kind === 'flagged')
    setDriverFault(false)
  }

  async function submit(item: ExceptionItem) {
    const key = `${item.kind}-${item.orderId}`
    setBusy(true)
    try {
      let res: Response
      if (mode === 'refund') {
        res = await fetch(`/api/admin/orders/${item.orderId}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Number(amount), reason: note, cancel: cancelToo, paymentId: paymentId || undefined, driverFault }),
        })
      } else {
        const action = mode === 'review' ? (item.kind === 'gps' ? 'gps_reviewed' : 'payment_reviewed') : mode
        res = await fetch(`/api/admin/exceptions/${item.orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, note }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg((m) => ({ ...m, [key]: { ok: false, text: data.error || 'Could not save' } }))
        return
      }
      setMsg((m) => ({
        ...m,
        [key]: {
          ok: true,
          text:
            mode === 'refund'
              ? data.awaitingApproval
                ? `Refund of GHS ${Number(data.awaitingApproval).toFixed(2)} recorded. A colleague must approve it before it is sent.`
                : `Refund of GHS ${Number(data.refunded ?? 0).toFixed(2)} started.`
              : mode === 'retry'
              ? `Back in the queue for the night of ${data.night}.`
              : mode === 'attempt_fee'
              ? `Driver paid GHS ${Number(data.driverShare ?? 0).toFixed(2)} for the trip. ${
                  data.awaitingApproval ? 'The refund waits for a colleague to approve it.' : `Refund of GHS ${Number(data.refund ?? 0).toFixed(2)} started.`
                }`
              : 'Done.',
        },
      }))
      setOpen(null)
      router.refresh()
    } catch {
      setMsg((m) => ({ ...m, [key]: { ok: false, text: 'Could not reach Trashit. Please try again.' } }))
    } finally {
      setBusy(false)
    }
  }

  // The selected exception in full: what happened, the people, the money, and the actions (unchanged).
  function detail(item: ExceptionItem) {
    const key = `${item.kind}-${item.orderId}`
    const canRefundThis = canRefund && item.payments.some((p) => p.refundable > 0)
    const m = msg[key]
    const Section = SECTIONS[item.kind]
    return (
      <article key={key} aria-labelledby="exception-title" className="anim-rise rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-3">
          <Section.icon aria-hidden className="size-4" /> {Section.title}
        </p>
        <h2 id="exception-title" className="sr-only">
          {item.address}
        </h2>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 basis-72">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink-2 ring-1 ring-line">
                              {ORDER_STATUS[item.status] ?? item.status}
                            </span>
                            <span className="text-xs text-ink-3">Updated {dateTimeLabel(item.updatedAt)}</span>
                          </div>
                          <p className="mt-2 font-semibold">{item.address}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                            <span>{item.customerName}</span>
                            {item.customerPhone && (
                              <a href={`tel:${item.customerPhone}`} className="inline-flex items-center gap-1 font-medium text-action-deep hover:underline">
                                <Phone aria-hidden className="size-3.5" /> {item.customerPhone}
                              </a>
                            )}
                            {item.price != null && <span className="tabular-nums">GHS {item.price.toFixed(2)}</span>}
                            {item.driverName && <span>Driver: {item.driverName}</span>}
                          </p>
                          <p className="mt-2.5 rounded-control bg-canvas p-3 text-sm text-ink">{item.reason}</p>
                          {item.payments.length > 0 && (
                            <p className="mt-2 text-sm text-ink-3">
                              {item.payments.map((p) => `Paid GHS ${p.amount.toFixed(2)}${PAYMENT_STATE[p.status] ? ` (${PAYMENT_STATE[p.status]})` : ''}, GHS ${p.refundable.toFixed(2)} refundable`).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.kind === 'flagged' && (
                            <>
                              <button type="button" className={BUTTON_QUIET} onClick={() => start(item, 'retry')}>
                                Try again
                              </button>
                              {item.payments.every((p) => p.refundable <= 0) && (
                                <button type="button" className={BUTTON_QUIET} onClick={() => start(item, 'close')}>
                                  Close (nothing to refund)
                                </button>
                              )}
                              {canRefundThis && item.status === 'FAILED_PICKUP' && item.price != null && (
                                <button type="button" className={BUTTON_QUIET} onClick={() => start(item, 'attempt_fee')}>
                                  {attemptFeePercent > 0 ? 'Customer\u2019s fault: attempt fee' : 'Customer\u2019s fault: full refund'}
                                </button>
                              )}
                            </>
                          )}
                          {item.kind !== 'flagged' && (
                            <button type="button" className={BUTTON_QUIET} onClick={() => start(item, 'review')}>
                              Mark checked
                            </button>
                          )}
                          {canRefundThis && (
                            <button type="button" className={BUTTON_DANGER} onClick={() => start(item, 'refund')}>
                              <Undo2 aria-hidden className="size-4" /> Refund
                            </button>
                          )}
                        </div>
                      </div>
  
                      {open === key && (
                        <div className="mt-4 border-t border-line pt-4">
                          <p className="text-sm text-ink-2">
                            {mode === 'retry' && 'The order goes back into tonight’s queue (or the coming night) and is assigned to a driver as usual. The customer is told.'}
                            {mode === 'close' && 'Nothing is left to refund, so the order is just cancelled. The customer is told, with your note.'}
                            {mode === 'review' && 'Takes this off the list. Nothing else changes.'}
                            {mode === 'refund' && 'Sends money back to the account the customer paid with, through Paystack.'}
                            {mode === 'attempt_fee' &&
                              item.price != null &&
                              (attemptFeePercent > 0
                                ? `The bin wasn't out, the gate was locked or the pin was wrong. Trashit keeps GHS ${attemptPreview(item.price, attemptFeePercent).fee.toFixed(2)} (${attemptFeePercent}%, Pricing page) for the wasted trip and pays the driver from it; GHS ${attemptPreview(item.price, attemptFeePercent).refund.toFixed(2)} goes back to the customer and the order is cancelled.`
                                : `The bin wasn't out, the gate was locked or the pin was wrong. The attempt fee is 0% (Pricing page), so the customer gets all GHS ${item.price.toFixed(2)} back, the driver is not paid for the trip, and the order is cancelled.`)}
                          </p>
                          {mode === 'refund' && (
                            <div className="mt-3 flex flex-wrap items-end gap-3">
                              {item.payments.length > 1 && (
                                <label>
                                  <span className="text-sm font-medium text-ink-2">Payment</span>
                                  <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className={`${FIELD} mt-1.5 w-auto`}>
                                    {item.payments.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        GHS {p.amount.toFixed(2)} ({PAYMENT_STATE[p.status] ?? p.status})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <label>
                                <span className="text-sm font-medium text-ink-2">Amount (GHS)</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={amount}
                                  onChange={(e) => setAmount(e.target.value)}
                                  className={`${FIELD} mt-1.5 w-36 tabular-nums`}
                                />
                              </label>
                              <label className="flex min-h-11 items-center gap-2 text-[15px]">
                                <input type="checkbox" checked={cancelToo} onChange={(e) => setCancelToo(e.target.checked)} className="size-4 accent-[var(--color-action-deep)]" />
                                Also cancel the order
                              </label>
                              {item.driverName && (
                                <label className="flex min-h-11 items-start gap-2 text-[15px]">
                                  <input
                                    type="checkbox"
                                    checked={driverFault}
                                    onChange={(e) => setDriverFault(e.target.checked)}
                                    className="mt-1 size-4 accent-[var(--color-danger)]"
                                  />
                                  <span>
                                    The driver was at fault
                                    <span className="block text-sm text-ink-3">
                                      Takes back what {item.driverName.split(/\s+/)[0]} earned on this order, up to the refund, once it&apos;s sent.
                                    </span>
                                  </span>
                                </label>
                              )}
                            </div>
                          )}
                          <label className="mt-3 block">
                            <span className="text-sm font-medium text-ink-2">Note (required, kept on the order&apos;s history)</span>
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              className={`${FIELD} mt-1.5`}
                              placeholder="e.g. Called the customer, gate will be open tomorrow"
                            />
                          </label>
                          <div className="mt-3 flex flex-wrap gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                (mode !== 'refund' && mode !== 'attempt_fee') ||
                                confirm(
                                  mode === 'attempt_fee' && item.price != null
                                    ? attemptFeePercent > 0
                                      ? `Keep GHS ${attemptPreview(item.price, attemptFeePercent).fee.toFixed(2)} for the wasted trip, pay the driver from it, and refund GHS ${attemptPreview(item.price, attemptFeePercent).refund.toFixed(2)}?`
                                      : `Refund all GHS ${item.price.toFixed(2)} and cancel the order?`
                                    : `Refund GHS ${Number(amount || 0).toFixed(2)} to the customer${cancelToo ? ' and cancel the order' : ''}${driverFault ? ', taking back the driver\'s pay' : ''}?`
                                )
                                  ? submit(item)
                                  : undefined
                              }
                              disabled={busy || note.trim().length < 3}
                              className={mode === 'refund' || mode === 'attempt_fee' ? BUTTON_DANGER : BUTTON_PRIMARY}
                            >
                              {busy
                                ? 'Saving…'
                                : mode === 'refund'
                                ? `Refund GHS ${Number(amount || 0).toFixed(2)}`
                                : mode === 'attempt_fee' && item.price != null
                                ? `Refund GHS ${attemptPreview(item.price, attemptFeePercent).refund.toFixed(2)}${attemptFeePercent > 0 ? ', pay the driver' : ''}`
                                : 'Confirm'}
                            </button>
                            <button type="button" onClick={() => setOpen(null)} disabled={busy} className={BUTTON_QUIET}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <p aria-live="polite" className={`mt-2 text-sm empty:hidden ${m?.ok ? 'text-ok-deep' : 'text-danger'}`}>
                        {m?.text}
                      </p>
        </article>
    )
  }

  const kinds: ExceptionItem['kind'][] = ['flagged', 'payment', 'gps']
  const shown = filter === 'all' ? items : items.filter((i) => i.kind === filter)
  const current = shown.find((i) => `${i.kind}-${i.orderId}` === selected) ?? shown[0] ?? null
  const openRefunds = refunds.filter((r) => ['AWAITING_APPROVAL', 'NEEDS_ATTENTION', 'PENDING', 'PROCESSING'].includes(r.status)).length

  return (
    <div className="grid gap-10">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        {/* The list: filter by kind, then pick one */}
        <div className="grid gap-3">
          <div role="tablist" aria-label="Kinds" className="flex flex-wrap gap-2">
            {(['all', ...kinds] as const).map((k) => {
              const n = k === 'all' ? items.length : items.filter((i) => i.kind === k).length
              const on = filter === k
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(k)}
                  className={`press inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition ${
                    on ? 'bg-selected text-on-selected' : 'bg-surface text-ink-2 ring-1 ring-line hover:text-ink'
                  }`}
                >
                  {k === 'all' ? 'All' : SECTIONS[k].title}
                  <span className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${on ? 'bg-white/20' : n > 0 ? 'bg-danger-wash text-danger' : 'bg-canvas text-ink-3'}`}>{n}</span>
                </button>
              )
            })}
            <a href="#refunds" className="inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink-2 ring-1 ring-line hover:bg-surface">
              Refunds
              <span className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${openRefunds > 0 ? 'bg-action-wash text-action-deep' : 'bg-canvas text-ink-3'}`}>{openRefunds}</span>
            </a>
          </div>

          {shown.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-card bg-surface p-4 text-[15px] text-ink-2 ring-1 ring-line">
              <CheckCircle2 aria-hidden className="size-5 text-ok-deep" /> Nothing here right now.
            </p>
          ) : (
            <ul className="anim-stagger grid gap-2">
              {shown.map((item) => {
                const key = `${item.kind}-${item.orderId}`
                const on = current != null && key === `${current.kind}-${current.orderId}`
                const Section = SECTIONS[item.kind]
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setSelected(key)
                        setOpen(null)
                        if (window.matchMedia('(max-width: 1023px)').matches) document.getElementById('exception-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`lift flex w-full items-start gap-3 rounded-[18px] p-3.5 text-left ring-1 ${on ? 'bg-action-wash ring-2 ring-action-deep' : 'bg-surface ring-line'}`}
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${item.kind === 'flagged' ? 'bg-danger-wash text-danger' : 'bg-warn-wash text-warn-deep'}`}>
                        <Section.icon aria-hidden className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.address}</span>
                        <span className="block truncate text-sm text-ink-3">{item.reason}</span>
                        <span className="mt-1 block text-xs text-ink-3">
                          {ORDER_STATUS[item.status] ?? item.status} · {dateTimeLabel(item.updatedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* The detail panel */}
        <div id="exception-detail" className="scroll-mt-20 lg:sticky lg:top-24">
          {current ? (
            detail(current)
          ) : (
            <p className="rounded-card bg-surface p-6 text-[15px] text-ink-2 ring-1 ring-line">Pick an exception to see it here.</p>
          )}
          {current && <p className="mt-2 text-sm text-ink-3">{SECTIONS[current.kind].hint}</p>}
        </div>
      </div>

      <section id="refunds" aria-labelledby="h-refunds" className="scroll-mt-20">
        <h2 id="h-refunds" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Undo2 aria-hidden className="size-5 text-ink-3" /> Refunds
        </h2>
        <p className="mt-1 text-sm text-ink-3">Open refunds, and everything from the last 14 days.</p>
        {refunds.length === 0 ? (
          <p className="mt-3 rounded-card bg-surface p-4 text-[15px] text-ink-2 ring-1 ring-line">No refunds.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-card bg-surface ring-1 ring-line">
            {refunds.map((r) => {
              const state = refundState(r)
              return (
                <li key={r.id} className="p-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        <span className="tabular-nums">GHS {r.amount.toFixed(2)}</span> · {r.customerName}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-3">
                        {r.address} · {dateTimeLabel(r.createdAt)}
                      </p>
                      {r.reason && <p className="mt-1 text-sm text-ink-2">{r.reason}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.cls}`}>{state.text}</span>
                  </div>
                  {canRefund && r.status === 'NEEDS_ATTENTION' && <SettleRefund id={r.id} />}
                  {canRefund && r.status === 'AWAITING_APPROVAL' && !r.requestedByMe && <ApproveRefund id={r.id} amount={r.amount} />}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
