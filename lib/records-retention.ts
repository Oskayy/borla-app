// Records older than 6 years: anonymised one calendar year at a time, with two people (decided Oct 2026).
// A year's records become due on 1 January seven years later (records from 2026 on 1 Jan 2033), the way tax
// records are counted (six years after the year ends). Accra is on UTC all year, so years run in UTC.
// Anonymising keeps every amount, date and ID, so totals and the double-entry ledger still balance; it removes
// what identifies a person (pins, addresses, wallet numbers and names, free-text notes, comments and reasons).

import { RECORDS_YEARS } from '@/lib/retention'

export const RECORDS_START_ROLES = ['SUPER_ADMIN'] as const
export const RECORDS_APPROVE_ROLES = ['SUPER_ADMIN', 'FINANCE'] as const
export const RECORDS_PAGE_ROLES = ['SUPER_ADMIN', 'FINANCE'] as const

// Orders in these states are settled; anything else is left alone and counted as skipped.
export const SETTLED_ORDER_STATUSES = ['COMPLETED', 'CANCELLED', 'DISPOSAL_VERIFIED'] as const
export const SETTLED_WITHDRAWAL_STATUSES = ['PAID', 'FAILED', 'REJECTED'] as const

export const REMOVED = 'Removed (older than 6 years)'
// A run that has been RUNNING this long has stopped (server timeout) and can be started again; the work is safe to repeat.
export const STUCK_MINUTES = 15

export type RunStatus = 'REQUESTED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
export interface RunLike {
  status: string
  requestedBy: string
  approvedAt: Date | null
}

export function dueDate(year: number): Date {
  return new Date(Date.UTC(year + RECORDS_YEARS + 1, 0, 1))
}

export function isDue(year: number, now: Date): boolean {
  return now.getTime() >= dueDate(year).getTime()
}

export function yearRange(year: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
}

export function isStuck(run: RunLike, now: Date): boolean {
  return run.status === 'RUNNING' && !!run.approvedAt && now.getTime() - run.approvedAt.getTime() > STUCK_MINUTES * 60_000
}

// Why this person can't approve (or re-run) this request, or null when they can.
export function approveProblem(run: RunLike, approverId: string, approverRole: string, now: Date): string | null {
  if (!(RECORDS_APPROVE_ROLES as readonly string[]).includes(approverRole)) return 'Only a super admin or finance user can approve this.'
  if (run.requestedBy === approverId) return 'A different person has to approve this. You asked for it.'
  if (run.status === 'REQUESTED' || run.status === 'FAILED' || isStuck(run, now)) return null
  if (run.status === 'RUNNING') return 'This is already running.'
  return 'This request is closed.'
}

// The years shown on the page: from the oldest record's year to last year.
export function yearsToShow(oldestYear: number | null, now: Date): number[] {
  const last = now.getUTCFullYear() - 1
  if (oldestYear === null || oldestYear > last) return []
  const out: number[] = []
  for (let y = last; y >= oldestYear; y--) out.push(y)
  return out
}
