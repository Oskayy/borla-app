import { describe, expect, it } from 'vitest'
import { approveProblem, dueDate, isDue, isStuck, yearRange, yearsToShow } from '@/lib/records-retention'

const run = (over: Partial<{ status: string; requestedBy: string; approvedAt: Date | null }> = {}) => ({
  status: 'REQUESTED',
  requestedBy: 'admin-a',
  approvedAt: null,
  ...over,
})

describe('records older than 6 years', () => {
  it('makes a year due on 1 January seven years later', () => {
    expect(dueDate(2026).toISOString()).toBe('2033-01-01T00:00:00.000Z')
    expect(isDue(2026, new Date('2032-12-31T23:59:59Z'))).toBe(false)
    expect(isDue(2026, new Date('2033-01-01T00:00:00Z'))).toBe(true)
  })

  it('covers exactly one calendar year', () => {
    expect(yearRange(2026)).toEqual({ gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') })
  })

  it('lists finished years only, newest first', () => {
    expect(yearsToShow(2026, new Date('2026-10-13T00:00:00Z'))).toEqual([])
    expect(yearsToShow(2026, new Date('2029-03-01T00:00:00Z'))).toEqual([2028, 2027, 2026])
    expect(yearsToShow(null, new Date('2029-03-01T00:00:00Z'))).toEqual([])
  })

  it('needs a second person to approve', () => {
    const now = new Date()
    expect(approveProblem(run(), 'admin-a', 'SUPER_ADMIN', now)).toMatch(/different person/)
    expect(approveProblem(run(), 'finance-b', 'FINANCE', now)).toBeNull()
    expect(approveProblem(run(), 'ops-c', 'OPS_MANAGER', now)).toMatch(/super admin or finance/)
  })

  it('lets a failed or stuck run be approved again, but not a running or finished one', () => {
    const now = new Date('2033-02-01T12:00:00Z')
    expect(approveProblem(run({ status: 'FAILED' }), 'finance-b', 'FINANCE', now)).toBeNull()
    expect(approveProblem(run({ status: 'RUNNING', approvedAt: new Date('2033-02-01T11:55:00Z') }), 'finance-b', 'FINANCE', now)).toMatch(/already running/)
    const stuck = run({ status: 'RUNNING', approvedAt: new Date('2033-02-01T11:30:00Z') })
    expect(isStuck(stuck, now)).toBe(true)
    expect(approveProblem(stuck, 'finance-b', 'FINANCE', now)).toBeNull()
    expect(approveProblem(run({ status: 'DONE' }), 'finance-b', 'FINANCE', now)).toMatch(/closed/)
  })
})
