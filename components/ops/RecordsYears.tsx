'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { Chip, Result } from '@/components/ops/kit'
import type { YearCounts } from '@/lib/records-retention-server'

export interface YearRow {
  year: number
  due: boolean
  dueOn: string
  counts: YearCounts | null
  run: {
    id: string
    status: string // REQUESTED | RUNNING | STUCK | DONE | FAILED
    requestedBy: string
    requestedAt: string
    mine: boolean
    approvedBy: string | null
    finishedAt: string | null
    summary: string | null
  } | null
}

const STATUS: Record<string, { text: string; tone: 'neutral' | 'ops' | 'danger' }> = {
  REQUESTED: { text: 'Waiting for approval', tone: 'neutral' },
  RUNNING: { text: 'Running', tone: 'neutral' },
  STUCK: { text: 'Stopped part way', tone: 'danger' },
  FAILED: { text: 'Stopped part way', tone: 'danger' },
  DONE: { text: 'Anonymised', tone: 'ops' },
}

export default function RecordsYears({ rows, canRequest }: { rows: YearRow[]; canRequest: boolean }) {
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <YearItem key={r.year} row={r} canRequest={canRequest} />
      ))}
    </ul>
  )
}

function YearItem({ row, canRequest }: { row: YearRow; canRequest: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const run = row.run
  const status = run ? STATUS[run.status] : null
  const canApprove = run && !run.mine && ['REQUESTED', 'FAILED', 'STUCK'].includes(run.status)

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'That did not work. Please try again.' })
        return
      }
      setMsg({ ok: true, text: data.summary ? `Done: ${data.summary}.` : done })
      setPassword('')
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Could not reach Trashit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold tabular-nums">Records from {row.year}</h3>
        {status ? <Chip tone={status.tone}>{status.text}</Chip> : row.due ? <Chip tone="danger">Due</Chip> : <Chip>Due {row.dueOn}</Chip>}
      </div>

      {row.counts && (
        <p className="mt-2 text-[15px] text-ink-2">
          {row.counts.orders} settled order(s), {row.counts.withdrawals} payout(s) and {row.counts.staffLogs} staff log entr{row.counts.staffLogs === 1 ? 'y' : 'ies'}.
          {row.counts.skippedOrders > 0 && ` ${row.counts.skippedOrders} order(s) aren't settled yet and will be left alone.`}
        </p>
      )}
      {!row.due && !run && <p className="mt-2 text-[15px] text-ink-3">Kept for tax until {row.dueOn}.</p>}

      {run && (
        <p className="mt-2 text-sm text-ink-3">
          {run.requestedBy} asked on {run.requestedAt}
          {run.approvedBy && `; ${run.approvedBy} approved`}
          {run.finishedAt && `; finished ${run.finishedAt}`}.
          {run.summary && ` ${run.status === 'DONE' ? run.summary : `Last error: ${run.summary}`}.`}
        </p>
      )}

      {row.due && !run && canRequest && (
        <button type="button" disabled={busy} onClick={() => send({ action: 'request', year: row.year }, 'Asked. A different super admin or finance user now approves it.')} className={`${BUTTON_PRIMARY} mt-4`}>
          {busy ? 'Asking…' : `Ask to anonymise ${row.year}`}
        </button>
      )}
      {row.due && !run && !canRequest && <p className="mt-3 text-sm text-ink-3">A super admin asks for this; you can then approve it.</p>}

      {run?.mine && run.status === 'REQUESTED' && <p className="mt-3 text-sm text-ink-3">Waiting for a different super admin or finance user to approve it.</p>}

      {canApprove && (
        <form
          className="mt-4 grid gap-3 sm:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            send({ action: 'approve', id: run.id, password }, 'Done.')
          }}
        >
          <p className="text-sm font-medium text-ink">This can&apos;t be undone. Enter your password to approve and run it now.</p>
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Your password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${FIELD} mt-1.5`} />
          </label>
          <button type="submit" disabled={busy || !password} className={BUTTON_DANGER}>
            {busy ? 'Anonymising… (keep this page open)' : run.status === 'REQUESTED' ? `Approve and anonymise ${row.year}` : 'Run it again to finish'}
          </button>
        </form>
      )}

      {run && ['REQUESTED', 'FAILED'].includes(run.status) && (
        <button type="button" disabled={busy} onClick={() => send({ action: 'cancel', id: run.id }, 'Request cancelled.')} className={`${BUTTON_QUIET} mt-3`}>
          Cancel request
        </button>
      )}
      <Result msg={msg} />
    </li>
  )
}
