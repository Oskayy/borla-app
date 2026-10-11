// F1, F4, F5 and other security rules, tested without a database.
import { describe, expect, it } from 'vitest'
import { OPEN_WITHDRAWAL_STATUSES, payoutHoldEndsAt, PAYOUT_CHANGE_HOLD_HOURS } from '@/lib/wallet'
import { computeWallet } from '@/lib/earnings'
import { LIVE_REFUND_STATUSES, needsSecondApprover, REFUND_APPROVAL_THRESHOLD_GHS, refundable } from '@/lib/refunds'
import { pickupFlags } from '@/lib/plausibility'
import { isValidEvidencePath } from '@/lib/storage'
import { getClientIp } from '@/lib/rate-limit'

const H = 3600_000

describe('F1: payout wallet change hold', () => {
  const changed = new Date('2026-10-04T10:00:00Z')
  it('is 24 hours', () => expect(PAYOUT_CHANGE_HOLD_HOURS).toBe(24))
  it('holds withdrawals for 24 hours after a change', () => {
    expect(payoutHoldEndsAt(changed, new Date(changed.getTime() + 1 * H))?.toISOString()).toBe('2026-10-05T10:00:00.000Z')
    expect(payoutHoldEndsAt(changed, new Date(changed.getTime() + 23.9 * H))).not.toBeNull()
  })
  it('ends after 24 hours, and never applies without a change', () => {
    expect(payoutHoldEndsAt(changed, new Date(changed.getTime() + 24 * H))).toBeNull()
    expect(payoutHoldEndsAt(null, new Date())).toBeNull()
  })
})

describe('F5: withdrawals waiting for a second approver', () => {
  it('count as open (no second request, no wallet change)', () => {
    expect(OPEN_WITHDRAWAL_STATUSES).toContain('CONFIRMING')
  })
  it('still hold the money in the balance', () => {
    const cleared = new Date('2026-10-01T00:00:00Z')
    const w = computeWallet(
      [{ orderId: 'o', type: 'driver_payout_disposal', amountPesewas: 10_000, clearsAt: cleared, createdAt: cleared }],
      [{ amountPesewas: 6_000, status: 'CONFIRMING' }],
      new Map(),
      new Date('2026-10-04T00:00:00Z'),
      null
    )
    expect(w).toMatchObject({ earned: 10_000, paidOut: 0, inFlight: 6_000, available: 4_000 })
  })
})

describe('F5: large staff refunds', () => {
  it(`need a second approver from GHS ${REFUND_APPROVAL_THRESHOLD_GHS}`, () => {
    expect(needsSecondApprover(REFUND_APPROVAL_THRESHOLD_GHS)).toBe(true)
    expect(needsSecondApprover(REFUND_APPROVAL_THRESHOLD_GHS - 0.01)).toBe(false)
  })
  it('hold the amount while waiting, so it cannot be refunded twice', () => {
    expect(LIVE_REFUND_STATUSES).toContain('AWAITING_APPROVAL')
    expect(refundable(120, [120])).toBe(0)
  })
})

describe('F4: pickup plausibility flags', () => {
  const pin = { lat: 5.6037, lng: -0.187 }
  const at = new Date('2026-10-04T22:00:00Z')
  const base = { gps: pin, accuracyM: 10, pin, previous: null, at, photoUsedElsewhere: false }

  it('passes a clean pickup', () => expect(pickupFlags(base)).toEqual([]))
  it('flags a missing GPS position', () => expect(pickupFlags({ ...base, gps: null })[0]).toMatch(/no GPS/))
  it('flags weak GPS', () => expect(pickupFlags({ ...base, accuracyM: 500 })[0]).toMatch(/weak GPS/))
  it('flags a photo far from the pin', () => {
    expect(pickupFlags({ ...base, gps: { lat: 5.62, lng: -0.187 } })[0]).toMatch(/GPS MISMATCH/)
  })
  it('flags impossible travel since the last pickup', () => {
    const previous = { lat: 5.7, lng: -0.187, at: new Date(at.getTime() - 2 * 60_000) } // ~11 km in 2 min
    expect(pickupFlags({ ...base, previous }).join()).toMatch(/km\/h/)
  })
  it('allows normal travel', () => {
    const previous = { lat: 5.62, lng: -0.187, at: new Date(at.getTime() - 15 * 60_000) } // ~1.8 km in 15 min
    expect(pickupFlags({ ...base, previous })).toEqual([])
  })
  it('flags a reused photo', () => expect(pickupFlags({ ...base, photoUsedElsewhere: true })[0]).toMatch(/same photo/))
})

describe('photo paths', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  it('accepts a photo inside the order folder', () => expect(isValidEvidencePath(`${id}/pickup-1.jpg`, id)).toBe(true))
  it('rejects other folders and path tricks', () => {
    expect(isValidEvidencePath('22222222-2222-4222-8222-222222222222/a.jpg', id)).toBe(false)
    expect(isValidEvidencePath(`${id}/../x.jpg`, id)).toBe(false)
    expect(isValidEvidencePath(`${id}/a/b.jpg`, id)).toBe(false)
  })
})

describe('F3: client IP for rate limits', () => {
  const req = (h: Record<string, string>) => new Request('http://x/', { headers: h })
  it('uses the host-set header, not what the caller sends', () => {
    expect(getClientIp(req({ 'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 1.2.3.4' }))).toBe('1.2.3.4')
  })
  it('without it, takes the last X-Forwarded-For entry (added by our proxy)', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5' }))).toBe('5.5.5.5')
  })
})
