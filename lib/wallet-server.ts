import { prisma } from '@/lib/prisma'
import { summarizeWallet, type WalletSummary } from '@/lib/wallet'

export const PAYOUT_ROLES = ['SUPER_ADMIN', 'FINANCE']

const EARNING_TYPES = ['driver_payout_pickup', 'driver_payout_disposal']

// A driver's balance, worked out from the ledger (earnings) and their withdrawals.
// Pass `tx` to read inside a transaction.
export async function getWalletSummary(driverId: string, tx: any = prisma): Promise<WalletSummary> {
  const [earnings, withdrawals] = await Promise.all([
    tx.ledgerEntry.findMany({ where: { driverId, type: { in: EARNING_TYPES } }, select: { amount: true } }),
    tx.withdrawal.findMany({ where: { driverId }, select: { amount: true, status: true } }),
  ])
  return summarizeWallet(
    earnings.map((e: { amount: number }) => e.amount),
    withdrawals
  )
}

export async function getEarningsHistory(driverId: string, take = 50) {
  return prisma.ledgerEntry.findMany({
    where: { driverId, type: { in: EARNING_TYPES } },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, type: true, amount: true, createdAt: true, order: { select: { id: true, quoteSnapshot: true } } },
  })
}
