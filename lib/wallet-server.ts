import type { Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeWallet, DRIVER_LEDGER_TYPES, EARNING_TYPES, NEW_DRIVER_DAYS, type WalletState } from '@/lib/earnings'

export const PAYOUT_ROLES: UserRole[] = ['SUPER_ADMIN', 'FINANCE']

// Refunds still under way: while one is open on an order, that order's earnings don't clear.
const OPEN_REFUND_STATUSES = ['AWAITING_APPROVAL', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION']

export interface WalletSummary {
  available: number // GHS: can be withdrawn now
  clearing: number // GHS: earned, not withdrawable yet
  nextClearAt: Date | null
  reserve: number // GHS: held back (new drivers)
  owed: number // GHS: taken back beyond the balance, paid off from future earnings
  pending: number // GHS: withdrawals requested or being sent
  paidOut: number // GHS: withdrawals sent
  earned: number // GHS: all earnings, after anything taken back
}

const ghs = (p: number) => p / 100

// A driver's balance (lib/earnings.ts), from their ledger rows, withdrawals, open complaints and refunds.
// Pass `tx` to read inside a transaction (withdrawals do, so two requests can't spend the same money).
export async function getWalletState(driverId: string, tx: Prisma.TransactionClient = prisma, now = new Date()): Promise<WalletState> {
  const [rows, withdrawals, profile] = await Promise.all([
    tx.ledgerEntry.findMany({
      where: { driverId, type: { in: DRIVER_LEDGER_TYPES } },
      select: { orderId: true, type: true, amount: true, amountPesewas: true, clearsAt: true, createdAt: true },
    }),
    tx.withdrawal.findMany({ where: { driverId }, select: { amount: true, status: true } }),
    tx.driverProfile.findUnique({ where: { userId: driverId }, select: { reviewedAt: true } }),
  ])
  const orderIds = Array.from(new Set(rows.map((r) => r.orderId)))
  const [disputes, refunds] = orderIds.length
    ? await Promise.all([
        tx.dispute.findMany({ where: { orderId: { in: orderIds }, status: 'OPEN' }, select: { orderId: true, createdAt: true } }),
        tx.refund.findMany({ where: { orderId: { in: orderIds }, status: { in: OPEN_REFUND_STATUSES } }, select: { orderId: true, createdAt: true } }),
      ])
    : [[], []]
  const blocked = new Map<string, Date>()
  for (const b of [...disputes, ...refunds]) {
    const seen = blocked.get(b.orderId)
    if (!seen || b.createdAt < seen) blocked.set(b.orderId, b.createdAt)
  }
  const since = profile?.reviewedAt ?? null
  const isNew = since && now.getTime() - since.getTime() < NEW_DRIVER_DAYS * 86_400_000 ? since : null
  return computeWallet(
    rows.map((r) => ({ orderId: r.orderId, type: r.type, amountPesewas: r.amountPesewas ?? Math.round(r.amount * 100), clearsAt: r.clearsAt, createdAt: r.createdAt })),
    withdrawals.map((w) => ({ amountPesewas: Math.round(w.amount * 100), status: w.status })),
    blocked,
    now,
    isNew
  )
}

export async function getWalletSummary(driverId: string, tx: Prisma.TransactionClient = prisma): Promise<WalletSummary> {
  const w = await getWalletState(driverId, tx)
  return {
    available: ghs(w.available),
    clearing: ghs(w.clearing),
    nextClearAt: w.nextClearAt,
    reserve: ghs(w.reserve),
    owed: ghs(w.owed),
    pending: ghs(w.inFlight),
    paidOut: ghs(w.paidOut),
    earned: ghs(w.earned),
  }
}

export async function getEarningsHistory(driverId: string, take = 50) {
  return prisma.ledgerEntry.findMany({
    where: { driverId, type: { in: DRIVER_LEDGER_TYPES } },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, type: true, amount: true, clearsAt: true, createdAt: true, order: { select: { id: true, quoteSnapshot: true } } },
  })
}

export { EARNING_TYPES }
