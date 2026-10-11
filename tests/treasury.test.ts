// Payment flow rewrite, step 5: the morning top-up check, the daily sweep and "Cash out now".
import { describe, expect, it } from 'vitest'
import { cashOutFee, cashOutIsInstant, planSweep, sweepTotal, topUpCheck } from '@/lib/treasury'

describe('morning top-up check', () => {
  it('adds transfer fees and a buffer (20% or the biggest recent night, whichever is more)', () => {
    expect(topUpCheck({ due: 100_000, transfers: 10, balance: 50_000, biggestNight: 5_000 })).toEqual({
      due: 100_000,
      fees: 1_000,
      buffer: 20_000,
      needed: 121_000,
      topUp: 71_000,
    })
    expect(topUpCheck({ due: 100_000, transfers: 10, balance: 0, biggestNight: 30_000 }).buffer).toBe(30_000)
  })
  it('asks for nothing when the balance is enough', () => {
    expect(topUpCheck({ due: 10_000, transfers: 1, balance: 1_000_000, biggestNight: 0 }).topUp).toBe(0)
  })
  it('treats a balance Paystack did not report as empty, so Finance is told', () => {
    expect(topUpCheck({ due: 10_000, transfers: 1, balance: null, biggestNight: 0 }).topUp).toBe(12_100)
  })
})

describe('daily sweep', () => {
  const base = { hasWallet: true, openWithdrawal: false, walletChangedRecently: false }
  const plan = planSweep([
    { driverId: 'a', available: 12_000, ...base },
    { driverId: 'b', available: 1_999, ...base }, // under GHS 20: waits
    { driverId: 'c', available: 150_000, ...base }, // over GHS 1,000: Finance
    { driverId: 'd', available: 5_000, ...base, walletChangedRecently: true }, // wallet just changed: Finance
    { driverId: 'e', available: 5_000, ...base, openWithdrawal: true }, // already on its way
    { driverId: 'f', available: 5_000, ...base, hasWallet: false },
  ])
  it('pays automatically only what it should', () => {
    expect(plan.auto).toEqual([{ driverId: 'a', amount: 12_000 }])
    expect(plan.forFinance.map((p) => p.driverId)).toEqual(['c', 'd'])
  })
  it('counts one GHS 1 transfer per automatic payout', () => {
    expect(sweepTotal(plan)).toEqual({ amount: 12_000, fees: 100 })
  })
})

describe('Cash out now', () => {
  it('is free once a day, then costs the GHS 1 transfer fee', () => {
    expect(cashOutFee(0)).toBe(0)
    expect(cashOutFee(1)).toBe(100)
  })
  it('is sent straight away up to GHS 500 when the balance covers it', () => {
    expect(cashOutIsInstant(50_000, 0, 60_000)).toBe(true)
    expect(cashOutIsInstant(50_001, 0, 1_000_000)).toBe(false)
    expect(cashOutIsInstant(10_000, 0, 10_050)).toBe(false) // can't cover the transfer fee too
    expect(cashOutIsInstant(10_000, 0, null)).toBe(false)
  })
})
