// Payment flow rewrite, step 4: every journal balances, and refunds are paid for in the right order.
import { describe, expect, it } from 'vitest'
import {
  ACCOUNTS,
  allocateRefund,
  earnedLines,
  estimatePaymentFee,
  feeIncomeLines,
  isBalanced,
  paymentFeeLines,
  paymentLines,
  payoutLines,
  refundLines,
  reverseLines,
  settlementLines,
  topUpLines,
  type Line,
} from '@/lib/accounts'

const sum = (lines: Line[], account: string, key?: { orderId?: string; driverId?: string }) =>
  lines
    .filter((l) => l.account === account && (!key?.orderId || l.orderId === key.orderId) && (!key?.driverId || l.driverId === key.driverId))
    .reduce((s, l) => s + l.amount, 0)

describe('journals balance', () => {
  it('every event adds up to zero', () => {
    const journals = [
      paymentLines('o', 5000),
      paymentFeeLines('o', 98),
      earnedLines('o', 'd', 1600),
      earnedLines('o', 'd', 2400),
      feeIncomeLines('o', 1000),
      payoutLines({ driverId: 'd', amount: 4000, driverFee: 0, method: 'paystack' }),
      payoutLines({ driverId: 'd', amount: 4000, driverFee: 100, method: 'paystack' }),
      payoutLines({ driverId: 'd', amount: 4000, driverFee: 0, method: 'manual' }),
      topUpLines(10_000),
      settlementLines(4902, 4900),
    ]
    for (const j of journals) expect(isBalanced(j)).toBe(true)
    expect(isBalanced(reverseLines(paymentLines('o', 5000)))).toBe(true)
  })

  it('estimates Paystack’s 1.95% when the event does not say (GHS 50 → GHS 0.98)', () => {
    expect(estimatePaymentFee(5000)).toBe(98)
  })
})

describe('the worked example: GHS 50, 20% fee, pickup 16, unload 24', () => {
  const all = [
    ...paymentLines('o', 5000),
    ...paymentFeeLines('o', 98),
    ...earnedLines('o', 'd', 1600),
    ...earnedLines('o', 'd', 2400),
    ...feeIncomeLines('o', 1000),
  ]
  it('leaves nothing held for the order once the job is finished', () => {
    expect(sum(all, ACCOUNTS.customerFundsHeld, { orderId: 'o' })).toBe(0)
  })
  it('owes the driver 40.00 and books 10.00 income only at the end', () => {
    expect(-sum(all, ACCOUNTS.driverPayable, { driverId: 'd' })).toBe(4000)
    expect(-sum(all, ACCOUNTS.platformFeeIncome)).toBe(1000)
    expect(sum(all, ACCOUNTS.paystackClearing)).toBe(4902)
  })
  it('pays the driver out of the Paystack balance with the GHS 1 fee as a cost', () => {
    const out = payoutLines({ driverId: 'd', amount: 4000, driverFee: 0, method: 'paystack' })
    expect(sum(out, ACCOUNTS.paystackBalance)).toBe(-4100)
    expect(sum(out, ACCOUNTS.transferFees)).toBe(100)
  })
  it('an extra cash-out: the driver pays the GHS 1, so Trashit has no transfer cost', () => {
    const out = payoutLines({ driverId: 'd', amount: 4000, driverFee: 100, method: 'paystack' })
    expect(sum(out, ACCOUNTS.paystackBalance)).toBe(-4000) // 39.00 sent + 1.00 Paystack fee
    expect(sum(out, ACCOUNTS.transferFees)).toBe(0)
  })
})

describe('who pays for a refund', () => {
  it('driver collected but never unloaded, full refund: 24 unearned + 16 clawed back + 10 fee', () => {
    const a = allocateRefund({ refund: 5000, held: 3400, feeNotYetIncome: 1000, feeIncome: 0, driverEarned: 1600, driverAtFault: true })
    expect(a).toEqual({ fromUnearned: 2400, clawback: 1600, feeFromHeld: 1000, feeReversed: 0, loss: 0 })
    const lines = refundLines('o', 'd', 5000, a)
    expect(isBalanced(lines)).toBe(true)
    const book = [...paymentLines('o', 5000), ...earnedLines('o', 'd', 1600), ...lines]
    expect(sum(book, ACCOUNTS.customerFundsHeld, { orderId: 'o' })).toBe(0)
    expect(sum(book, ACCOUNTS.driverPayable, { driverId: 'd' })).toBe(0)
  })

  it('a small refund comes from unearned shares first: no clawback even if the driver was at fault', () => {
    const a = allocateRefund({ refund: 2000, held: 3400, feeNotYetIncome: 1000, feeIncome: 0, driverEarned: 1600, driverAtFault: true })
    expect(a).toMatchObject({ fromUnearned: 2000, clawback: 0, loss: 0 })
  })

  it('gate locked (customer’s fault): the attempt fee was paid out, the rest is refunded from held money', () => {
    // attempt fee 12.50: driver 10.00, Trashit 2.50 (already income); 37.50 still held.
    const a = allocateRefund({ refund: 3750, held: 3750, feeNotYetIncome: 0, feeIncome: 250, driverEarned: 1000, driverAtFault: false })
    expect(a).toEqual({ fromUnearned: 3750, clawback: 0, feeFromHeld: 0, feeReversed: 0, loss: 0 })
  })

  it('goodwill refund after the job: the platform fee first, then Trashit’s own money', () => {
    const a = allocateRefund({ refund: 1500, held: 0, feeNotYetIncome: 0, feeIncome: 1000, driverEarned: 4000, driverAtFault: false })
    expect(a).toEqual({ fromUnearned: 0, clawback: 0, feeFromHeld: 0, feeReversed: 1000, loss: 500 })
    expect(isBalanced(refundLines('o', 'd', 1500, a))).toBe(true)
  })

  it('cancelled before pickup: everything comes back from held money', () => {
    const a = allocateRefund({ refund: 5000, held: 5000, feeNotYetIncome: 1000, feeIncome: 0, driverEarned: 0, driverAtFault: false })
    expect(a.fromUnearned + a.feeFromHeld).toBe(5000)
    expect(a.loss).toBe(0)
  })
})

describe('settlements', () => {
  it('keeps any difference between what Paystack sent and what arrived', () => {
    const lines = settlementLines(4902, 4900)
    expect(sum(lines, ACCOUNTS.reconciliationDifferences)).toBe(2)
    expect(sum(lines, ACCOUNTS.paystackClearing)).toBe(-4902)
  })
})
