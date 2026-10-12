// Payment flow rewrite, step 7: surcharge and discount routing, the distance bonus, and tax lines.
import { describe, expect, it } from 'vitest'
import { distanceBonus, splitOrder } from '@/lib/money-split'
import { snapshotTax, taxLines, taxTotal, withholding } from '@/lib/tax'

const ALL_TO_DRIVERS = { lateDriverBps: 10_000, hazardDriverBps: 10_000, discountPlatformBps: 10_000 }

describe('surcharges and discount', () => {
  it('without extras, the split is exactly as before', () => {
    expect(splitOrder(5000, 1500, 4000, { lateSurcharge: 0, hazardSurcharge: 0, recyclableDiscount: 0, ...ALL_TO_DRIVERS })).toEqual(splitOrder(5000, 1500, 4000))
  })
  it('the late surcharge goes to drivers in full (100%)', () => {
    // GHS 50 incl. GHS 5 late surcharge, 20% fee: drivers get 80% of 45 + all of 5 = 41.
    const s = splitOrder(5000, 2000, 4000, { lateSurcharge: 500, hazardSurcharge: 0, recyclableDiscount: 0, ...ALL_TO_DRIVERS })
    expect(s.pool).toBe(4100)
    expect(s.platformFee).toBe(900)
  })
  it('a surcharge split 50/50 when ops set 50%', () => {
    const s = splitOrder(5000, 2000, 4000, { lateSurcharge: 500, hazardSurcharge: 0, recyclableDiscount: 0, ...ALL_TO_DRIVERS, lateDriverBps: 5000 })
    expect(s.pool).toBe(3600 + 250)
  })
  it('the recyclable discount comes out of Trashit’s share', () => {
    // Price before discount 50, discount 7.50, paid 42.50, 20% fee: drivers paid 80% of 50 = 40; Trashit keeps 2.50.
    const s = splitOrder(4250, 2000, 4000, { lateSurcharge: 0, hazardSurcharge: 0, recyclableDiscount: 750, ...ALL_TO_DRIVERS })
    expect(s.pool).toBe(4000)
    expect(s.platformFee).toBe(250)
  })
  it('Trashit’s share never goes below zero', () => {
    const s = splitOrder(4250, 1000, 4000, { lateSurcharge: 0, hazardSurcharge: 0, recyclableDiscount: 2000, ...ALL_TO_DRIVERS })
    expect(s.platformFee).toBeGreaterThanOrEqual(0)
    expect(s.pool + s.platformFee).toBe(4250)
  })
  it('always adds up', () => {
    for (let p = 100; p < 20_000; p += 97) {
      const s = splitOrder(p, 1500, 4000, { lateSurcharge: Math.min(p, 300), hazardSurcharge: 0, recyclableDiscount: 123, lateDriverBps: 7000, hazardDriverBps: 10_000, discountPlatformBps: 5000 })
      expect(s.pickup + s.unload + s.platformFee).toBe(p)
    }
  })
})

describe('distance bonus', () => {
  const rule = { freeKm: 3, perKmPesewas: 100, capPesewas: 1000 }
  it('nothing within the free distance', () => expect(distanceBonus(2.9, rule, 5000)).toBe(0))
  it('GHS 1 per km beyond 3 km, whole pesewas', () => expect(distanceBonus(5.5, rule, 5000)).toBe(250))
  it('capped at GHS 10', () => expect(distanceBonus(40, rule, 5000)).toBe(1000))
  it('never more than the platform fee it is paid from', () => expect(distanceBonus(40, rule, 300)).toBe(300))
  it('off when the rate is 0', () => expect(distanceBonus(40, { ...rule, perKmPesewas: 0 }, 5000)).toBe(0))
})

describe('tax', () => {
  it('no lines while every rate is 0', () => expect(taxLines(5000, { vatBps: 0, nhilBps: 0, getfundBps: 0 })).toEqual([]))
  it('each line on the price before tax, rounded to the pesewa', () => {
    const lines = taxLines(5000, { vatBps: 1500, nhilBps: 250, getfundBps: 250 })
    expect(lines.map((l) => l.amount)).toEqual([125, 125, 750])
    expect(taxTotal(lines)).toBe(1000)
  })
  it('withholding rounds down, and is 0 while off', () => {
    expect(withholding(10_001, 750)).toBe(750)
    expect(withholding(10_000, 0)).toBe(0)
  })
  it('reads tax from a price snapshot', () => {
    expect(snapshotTax({ taxTotal: 1.25 })).toBe(125)
    expect(snapshotTax({})).toBe(0)
  })
})
