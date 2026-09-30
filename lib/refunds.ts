// Cancellations and refunds. Pure functions so they can be tested.

import { zonedInstant } from './offers'
import type { ShiftSettings } from './shift'

export const REFUND_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'FINANCE']

// Refunds that still hold money (not failed).
export const LIVE_REFUND_STATUSES = ['PENDING', 'PROCESSING', 'PROCESSED', 'NEEDS_ATTENTION']

// How much of a payment can still be refunded.
export function refundable(paymentAmount: number, liveRefunds: number[]): number {
  const paid = Math.round(paymentAmount * 100)
  const used = liveRefunds.reduce((s, a) => s + Math.round(a * 100), 0)
  return Math.max(0, paid - used) / 100
}

// A customer can cancel (for a full refund) a paid order until its collection night starts.
// After that a driver may already be on the way, so they need to contact Borla instead.
export function customerCancelCheck(
  order: { status: string; shiftDate: Date | string | null },
  now: Date,
  s: ShiftSettings
): { ok: boolean; error: string } {
  if (order.status === 'DRAFT') return { ok: false, error: 'This order was never paid. You can simply delete it.' }
  if (order.status !== 'PAID' && order.status !== 'ASSIGNED') {
    return { ok: false, error: 'This order can no longer be cancelled here. Please contact Borla support.' }
  }
  if (order.shiftDate) {
    const ymd = typeof order.shiftDate === 'string' ? order.shiftDate.slice(0, 10) : order.shiftDate.toISOString().slice(0, 10)
    const start = zonedInstant(ymd, s.shiftStartMinutes, s.timezone)
    if (now.getTime() >= start.getTime()) {
      return { ok: false, error: 'Collection for this order has already started, so it can’t be cancelled online. Please contact Borla support.' }
    }
  }
  return { ok: true, error: '' }
}

// Paystack refund status -> ours.
export function refundStatusFromPaystack(status: unknown): string {
  switch (status) {
    case 'processed':
      return 'PROCESSED'
    case 'failed':
      return 'FAILED'
    case 'needs-attention':
      return 'NEEDS_ATTENTION'
    case 'processing':
      return 'PROCESSING'
    default:
      return 'PENDING'
  }
}
