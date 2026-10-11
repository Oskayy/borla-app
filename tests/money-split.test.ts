// Payment flow rewrite, steps 2-3: the frozen split, earnings states, clawbacks and the attempt fee.
import { describe, expect, it } from 'vitest'
import { attemptSplit, pctToBps, splitOrder, storedSplit, splitColumns } from '@/lib/money-split'
import { CLAWBACK_TYPE, clawbackFor, clearsAt, computeWallet, PICKUP_TYPE, UNLOAD_TYPE, type DriverLedgerRow } from '@/lib/earnings'

const H = 3600_000

describe('order split (whole pesewas, basis points, remainder last)', () => {
  it('matches the worked example: GHS 33.33, 20% fee, 40/60', () => {
    const s = splitOrder(3333, 2000, 4000)
    expect(s).toMatchObject({ platformFee: 666, pool: 2667, pickup: 1066, unload: 1601 })
    expect(s.platformFee + s.pickup + s.unload).toBe(3333)
  })

  it('always adds up exactly, for any price and split (incl. 45/55)', () => {
    for (let price = 1; price <= 20_000; price += 37) {
      for (const [fee, pickup] of [[1500, 4000], [2000, 4500], [0, 5000], [1950, 3333], [10_000, 4000]]) {
        const s = splitOrder(price, fee, pickup)
        expect(s.platformFee + s.pickup + s.unload).toBe(price)
        expect(s.pickup).toBeGreaterThanOrEqual(0)
        expect(s.unload).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('refuses decimals and out-of-range rates', () => {
    expect(() => splitOrder(33.5, 2000, 4000)).toThrow()
    expect(() => splitOrder(100, 10_001, 4000)).toThrow()
    expect(() => splitOrder(-1, 0, 0)).toThrow()
  })

  it('turns stored percentages into basis points', () => {
    expect(pctToBps(15)).toBe(1500)
    expect(pctToBps(40)).toBe(4000)
    expect(pctToBps(1.95)).toBe(195)
  })

  it('round-trips through the order columns', () => {
    const s = splitOrder(5000, 2000, 4000)
    expect(storedSplit(splitColumns(s))).toEqual(s)
    expect(storedSplit({ pricePesewas: null, platformFeePesewas: null, pickupSharePesewas: null, unloadSharePesewas: null, feeBps: null, pickupBps: null })).toBeNull()
  })
})

describe('failed pickup, customer at fault (25% attempt fee)', () => {
  it('matches the worked example: GHS 50, 20% fee', () => {
    expect(attemptSplit(5000, 2000)).toEqual({ attemptFee: 1250, driverShare: 1000, platformShare: 250, refund: 3750 })
  })
  it('always adds up', () => {
    for (let p = 1; p < 20_000; p += 53) {
      const a = attemptSplit(p, 1500)
      expect(a.driverShare + a.platformShare + a.refund).toBe(p)
    }
  })
})

describe('earnings states', () => {
  const now = new Date('2026-10-12T12:00:00Z')
  const row = (orderId: string, type: string, amount: number, clears: Date | null, created = now): DriverLedgerRow => ({
    orderId,
    type,
    amountPesewas: amount,
    clearsAt: clears,
    createdAt: created,
  })
  const past = new Date(now.getTime() - H)
  const future = new Date(now.getTime() + 5 * H)

  it('clears 24 h after the later of the unload and the shift end', () => {
    const unloaded = new Date('2026-10-12T02:00:00Z')
    const shiftEnd = new Date('2026-10-12T06:00:00Z')
    expect(clearsAt(unloaded, shiftEnd).toISOString()).toBe('2026-10-13T06:00:00.000Z')
    expect(clearsAt(new Date('2026-10-12T07:00:00Z'), shiftEnd).toISOString()).toBe('2026-10-13T07:00:00.000Z')
  })

  it('keeps a pickup share that was never unloaded out of the balance', () => {
    const w = computeWallet([row('a', PICKUP_TYPE, 1600, null)], [], new Map(), now, null)
    expect(w).toMatchObject({ available: 0, clearing: 1600 })
  })

  it('makes a cleared order withdrawable, and shows when the next one clears', () => {
    const w = computeWallet(
      [row('a', PICKUP_TYPE, 1600, past), row('a', UNLOAD_TYPE, 2400, past), row('b', PICKUP_TYPE, 1000, future), row('b', UNLOAD_TYPE, 1500, future)],
      [],
      new Map(),
      now,
      null
    )
    expect(w).toMatchObject({ available: 4000, clearing: 2500, nextClearAt: future })
  })

  it('subtracts withdrawals that are requested, being sent, waiting to be confirmed or paid', () => {
    const rows = [row('a', PICKUP_TYPE, 1600, past), row('a', UNLOAD_TYPE, 2400, past)]
    const w = computeWallet(rows, [{ amountPesewas: 1000, status: 'CONFIRMING' }, { amountPesewas: 500, status: 'PAID' }, { amountPesewas: 900, status: 'FAILED' }], new Map(), now, null)
    expect(w).toMatchObject({ available: 2500, inFlight: 1000, paidOut: 500 })
  })

  it('holds earnings that had not cleared when a complaint or refund opened', () => {
    const rows = [row('a', PICKUP_TYPE, 1600, past), row('a', UNLOAD_TYPE, 2400, past)]
    const blockedBefore = computeWallet(rows, [], new Map([['a', new Date(past.getTime() - H)]]), now, null)
    expect(blockedBefore).toMatchObject({ available: 0, clearing: 4000 })
    // Opened after they cleared: they stay available.
    const blockedAfter = computeWallet(rows, [], new Map([['a', new Date(past.getTime() + 10)]]), now, null)
    expect(blockedAfter.available).toBe(4000)
  })

  it('a clawback after withdrawal becomes a debt paid from future earnings, never below zero available', () => {
    const rows = [row('a', PICKUP_TYPE, 1600, past), row('a', CLAWBACK_TYPE, 1600, null)]
    const w = computeWallet(rows, [{ amountPesewas: 1600, status: 'PAID' }], new Map(), now, null)
    expect(w).toMatchObject({ available: 0, owed: 1600 })
    const later = computeWallet([...rows, row('b', PICKUP_TYPE, 2000, past)], [{ amountPesewas: 1600, status: 'PAID' }], new Map(), now, null)
    expect(later).toMatchObject({ available: 400, owed: 0 })
  })

  it('new drivers keep a reserve: 10% of the last 7 days, at most GHS 100', () => {
    const rows = [row('a', PICKUP_TYPE, 30_000, past), row('a', UNLOAD_TYPE, 20_000, past)]
    const fresh = computeWallet(rows, [], new Map(), now, new Date(now.getTime() - 5 * 24 * H))
    expect(fresh).toMatchObject({ reserve: 5_000, available: 45_000 })
    const big = computeWallet([row('a', PICKUP_TYPE, 500_000, past)], [], new Map(), now, new Date(now.getTime() - 5 * 24 * H))
    expect(big.reserve).toBe(10_000)
    const settled = computeWallet(rows, [], new Map(), now, new Date(now.getTime() - 40 * 24 * H))
    expect(settled.reserve).toBe(0)
  })

  it('takes money back only when the driver was at fault, and never more than they earned on the order', () => {
    expect(clawbackFor(5000, false, 4000)).toBe(0)
    expect(clawbackFor(5000, true, 1600)).toBe(1600)
    expect(clawbackFor(1000, true, 4000)).toBe(1000)
  })
})
