'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquareWarning } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { MAX_REPORT_NOTE, PROBLEMS, type ProblemKind } from '@/lib/customer-reports'

// After collection: "Was everything collected?" with "Yes, all good" or a problem report. After a "gate locked"
// report: a short reply. Reports go to ops (and hold the driver's pay for the order until they're dealt with).
export default function OrderReport({ orderId, mode }: { orderId: string; mode: 'problems' | 'gateReply' }) {
  const router = useRouter()
  const [open, setOpen] = useState(mode === 'gateReply')
  const [kind, setKind] = useState<ProblemKind>('NOT_COLLECTED')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function send(body: { kind: string; note?: string }, thanks: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not send. Please try again.')
        return
      }
      setDone(thanks)
      router.refresh()
    } catch {
      setError('No connection. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p role="status" className="text-[15px] text-ink-2">{done}</p>

  if (mode === 'gateReply') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send({ kind: 'GATE_REPLY', note }, 'Thank you. Trashit will look into it and get back to you.')
        }}
        className="grid gap-3"
      >
        <p className="text-base font-semibold tracking-tight">Was your gate open, or your bins out?</p>
        <p className="text-sm text-ink-3">Tell us what you saw. Ops will check the driver&apos;s report and get back to you.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_REPORT_NOTE} rows={3} aria-label="What happened" className={FIELD} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy || note.trim().length < 3} className={`min-h-12 ${BUTTON_PRIMARY}`}>
          {busy ? 'Sending…' : 'Send reply'}
        </button>
      </form>
    )
  }

  return (
    <div className="grid gap-3">
      <p className="text-base font-semibold tracking-tight">Was everything collected?</p>
      {!open ? (
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={busy} onClick={() => send({ kind: 'ALL_GOOD' }, 'Thank you for letting us know.')} className={`min-h-11 ${BUTTON_PRIMARY}`}>
            Yes, all good
          </button>
          <button type="button" disabled={busy} onClick={() => setOpen(true)} className={`min-h-11 ${BUTTON_QUIET}`}>
            <MessageSquareWarning aria-hidden className="size-4" /> Report a problem
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send({ kind, note }, 'Thank you. Trashit will look into it and get back to you.')
          }}
          className="grid gap-3"
        >
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium text-ink-2">What went wrong?</legend>
            {(Object.keys(PROBLEMS) as ProblemKind[]).map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-2.5 text-[15px]">
                <input type="radio" name="problem" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-4 accent-[var(--color-action)]" />
                {PROBLEMS[k]}
              </label>
            ))}
          </fieldset>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_REPORT_NOTE}
            rows={3}
            placeholder={kind === 'OTHER' ? 'Please tell us what happened' : 'Anything that helps (optional)'}
            aria-label="Details"
            className={FIELD}
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={busy || (kind === 'OTHER' && note.trim().length < 3)} className={`min-h-11 ${BUTTON_PRIMARY}`}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className={`min-h-11 ${BUTTON_QUIET}`}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
