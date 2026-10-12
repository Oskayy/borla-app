// Driver earnings states and the wallet balance. Pure functions so they can be tested. All amounts in pesewas.
//
// Earnings move through three states (Payment flow rewrite, step 3):
//  - Clearing: the pickup share is added at pickup and the unload share at unload, so drivers see them straight
//    away, but they can't be withdrawn yet. A pickup share whose load is never unloaded doesn't clear: ops release
//    it (by confirming the unload) or take it back (a refund with the driver at fault).
//  - Available: once the trip is unloaded, the night's shift has ended and CLEARING_HOURS have passed, with no
//    complaint or refund open on that order.
//  - Paid: sent to the driver's MoMo wallet (a withdrawal).
// A refund with the driver at fault takes their shares of that order back (a clawback). If that pushes the
// balance below zero, their next earnings pay it off; nothing is ever taken from their MoMo wallet.

import { zonedInstant } from './offers'

export const CLEARING_HOURS = 24 // placeholder
export const NEW_DRIVER_DAYS = 30 // new drivers keep a small reserve for this long (placeholder)
export const RESERVE_BPS = 1_000 // reserve: 10% of the last RESERVE_WINDOW_DAYS of earnings (placeholder)
export const RESERVE_WINDOW_DAYS = 7
export const RESERVE_CAP_PESEWAS = 10_000 // never more than GHS 100 (placeholder)

export const PICKUP_TYPE = 'driver_payout_pickup'
export const UNLOAD_TYPE = 'driver_payout_disposal'
export const ATTEMPT_TYPE = 'driver_attempt_fee' // paid for a failed pickup that was the customer's fault
export const BONUS_TYPE = 'driver_distance_bonus' // for a stop far from the driver's home base (step 7)
export const CLAWBACK_TYPE = 'driver_clawback' // taken back after a refund with the driver at fault
export const EARNING_TYPES = [PICKUP_TYPE, UNLOAD_TYPE, ATTEMPT_TYPE, BONUS_TYPE]
export const DRIVER_LEDGER_TYPES = [...EARNING_TYPES, CLAWBACK_TYPE]

// When earnings for an unloaded load become available: after the unload and after the shift has ended,
// plus the clearing period.
export function clearsAt(unloadedAt: Date, shiftEndsAt: Date | null, hours = CLEARING_HOURS): Date {
  const from = Math.max(unloadedAt.getTime(), shiftEndsAt?.getTime() ?? 0)
  return new Date(from + hours * 3600_000)
}

// When the night's shift ends: the morning after the shift date when the shift crosses midnight (8pm-6am).
export function shiftEndsAt(
  shiftDate: Date | string | null,
  s: { shiftStartMinutes: number; shiftEndMinutes: number; timezone: string }
): Date | null {
  if (!shiftDate) return null
  const ymd = typeof shiftDate === 'string' ? shiftDate.slice(0, 10) : shiftDate.toISOString().slice(0, 10)
  if (s.shiftEndMinutes > s.shiftStartMinutes) return zonedInstant(ymd, s.shiftEndMinutes, s.timezone)
  const next = new Date(`${ymd}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return zonedInstant(next.toISOString().slice(0, 10), s.shiftEndMinutes, s.timezone)
}

export interface DriverLedgerRow {
  orderId: string
  type: string
  amountPesewas: number
  clearsAt: Date | null
  createdAt: Date
}

export interface WalletState {
  available: number // can be withdrawn now
  clearing: number // earned, not withdrawable yet
  nextClearAt: Date | null // when the next clearing earnings become available
  reserve: number // held back from available (new drivers only)
  owed: number // clawbacks larger than the balance; paid off from future earnings
  inFlight: number // withdrawals requested or being sent
  paidOut: number // withdrawals sent
  earned: number // all earnings ever, after clawbacks
}

const HOLDING = ['REQUESTED', 'PROCESSING', 'CONFIRMING', 'PAID']
const IN_FLIGHT = ['REQUESTED', 'PROCESSING', 'CONFIRMING']

// `blockedOrders`: orders with an open complaint or a refund under way, and since when. Earnings that hadn't
// cleared by then wait; earnings that had already cleared stay available (a clawback deals with them if needed).
// `newDriverSince`: approval date while the driver is within NEW_DRIVER_DAYS (else null).
export function computeWallet(
  rows: DriverLedgerRow[],
  withdrawals: { amountPesewas: number; status: string }[],
  blockedOrders: Map<string, Date>,
  now: Date,
  newDriverSince: Date | null
): WalletState {
  const byOrder = new Map<string, DriverLedgerRow[]>()
  for (const r of rows) byOrder.set(r.orderId, [...(byOrder.get(r.orderId) ?? []), r])

  let cleared = 0
  let clearing = 0
  let earned = 0
  let nextClearAt: Date | null = null
  for (const [orderId, list] of byOrder) {
    const earnings = list.filter((r) => r.type !== CLAWBACK_TYPE)
    const net = earnings.reduce((s, r) => s + r.amountPesewas, 0) - list.filter((r) => r.type === CLAWBACK_TYPE).reduce((s, r) => s + r.amountPesewas, 0)
    earned += net
    const blockedSince = blockedOrders.get(orderId)
    const isClear =
      earnings.length > 0 &&
      earnings.every((r) => r.clearsAt != null && r.clearsAt.getTime() <= now.getTime() && (!blockedSince || r.clearsAt.getTime() <= blockedSince.getTime()))
    if (isClear) {
      cleared += net
    } else {
      clearing += Math.max(0, net)
      cleared += Math.min(0, net) // a clawback larger than what's still clearing counts against the balance now
      if (!blockedSince) {
        for (const r of earnings) {
          if (r.clearsAt && r.clearsAt.getTime() > now.getTime() && (!nextClearAt || r.clearsAt < nextClearAt)) nextClearAt = r.clearsAt
        }
      }
    }
  }

  const holding = withdrawals.filter((w) => HOLDING.includes(w.status)).reduce((s, w) => s + w.amountPesewas, 0)
  const inFlight = withdrawals.filter((w) => IN_FLIGHT.includes(w.status)).reduce((s, w) => s + w.amountPesewas, 0)
  const paidOut = withdrawals.filter((w) => w.status === 'PAID').reduce((s, w) => s + w.amountPesewas, 0)

  const balance = cleared - holding
  let reserve = 0
  if (newDriverSince && now.getTime() - newDriverSince.getTime() < NEW_DRIVER_DAYS * 86_400_000) {
    const since = now.getTime() - RESERVE_WINDOW_DAYS * 86_400_000
    const recent = rows
      .filter((r) => r.type !== CLAWBACK_TYPE && r.createdAt.getTime() >= since)
      .reduce((s, r) => s + r.amountPesewas, 0)
    reserve = Math.min(RESERVE_CAP_PESEWAS, Math.floor((recent * RESERVE_BPS) / 10_000), Math.max(0, balance))
  }

  return {
    available: Math.max(0, balance - reserve),
    clearing,
    nextClearAt,
    reserve,
    owed: balance < 0 ? -balance : 0,
    inFlight,
    paidOut,
    earned,
  }
}

// How much of a refund is taken back from the driver: only when they were at fault, and never more than
// what they earned on that order (after earlier clawbacks).
export function clawbackFor(refundPesewas: number, driverAtFault: boolean, earnedOnOrder: number): number {
  if (!driverAtFault) return 0
  return Math.max(0, Math.min(refundPesewas, earnedOnOrder))
}
