// Payment flow rewrite, step 6: the daily comparisons flag any difference that isn't zero.
import { describe, expect, it } from 'vitest'
import { compareBalance, compareDrivers, compareFees, comparePayments, mustBeZero } from '@/lib/reconcile'

describe('daily reconciliation', () => {
  it('payments match when every reference and amount agrees', () => {
    const r = comparePayments([{ reference: 'a', amount: 5000 }], [{ reference: 'a', amount: 5000 }])
    expect(r.ok).toBe(true)
  })
  it('flags payments missing on either side, or with different amounts', () => {
    const r = comparePayments(
      [{ reference: 'a', amount: 5000 }, { reference: 'b', amount: 100 }],
      [{ reference: 'a', amount: 4900 }, { reference: 'c', amount: 700 }]
    )
    expect(r.ok).toBe(false)
    expect(r.details).toHaveLength(3)
  })
  it('flags fees that differ from what Paystack charged', () => {
    expect(compareFees(new Map([['a', 98]]), [{ reference: 'a', fees: 98 }]).ok).toBe(true)
    expect(compareFees(new Map([['a', 98]]), [{ reference: 'a', fees: 97 }]).ok).toBe(false)
  })
  it('expects the Paystack balance to equal the ledger less payouts still on their way', () => {
    expect(compareBalance({ ledger: 50_000, inFlight: 4_100, paystack: 45_900 }).ok).toBe(true)
    expect(compareBalance({ ledger: 50_000, inFlight: 0, paystack: 45_900 }).ok).toBe(false)
    expect(compareBalance({ ledger: 50_000, inFlight: 0, paystack: null }).ok).toBe(false)
  })
  it('compares each driver’s ledger balance with their wallet', () => {
    expect(compareDrivers([{ driverId: 'd1234567', ledger: 4000, wallet: 4000 }]).ok).toBe(true)
    expect(compareDrivers([{ driverId: 'd1234567', ledger: 4000, wallet: 3999 }]).ok).toBe(false)
  })
  it('counts that must be zero', () => {
    expect(mustBeZero('Ledger', 0, 'unbalanced journals').ok).toBe(true)
    expect(mustBeZero('Ledger', 2, 'unbalanced journals')).toMatchObject({ ok: false, summary: '2 unbalanced journals' })
  })
})
