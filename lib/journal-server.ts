import type { Prisma } from '@prisma/client'
import { ACCOUNTS, isBalanced, type Account, type Line } from '@/lib/accounts'

type Tx = Prisma.TransactionClient

// Records one money event as a balanced journal (lib/accounts.ts), inside the caller's transaction, so the
// journal is saved together with the change that caused it, or not at all. `key` makes it happen once:
// if a journal with this key exists, nothing is written. The database also refuses an unbalanced journal.
export async function postJournal(
  tx: Tx,
  args: { key: string; event: string; lines: Line[]; orderId?: string | null; driverId?: string | null; memo?: string | null; createdBy?: string | null }
): Promise<boolean> {
  if (args.lines.length === 0) return false
  if (!isBalanced(args.lines)) throw new Error(`UNBALANCED_JOURNAL:${args.key}`)
  const existing = await tx.journal.findUnique({ where: { key: args.key }, select: { id: true } })
  if (existing) return false
  await tx.journal.create({
    data: {
      key: args.key,
      event: args.event,
      orderId: args.orderId ?? null,
      driverId: args.driverId ?? null,
      memo: args.memo ?? null,
      createdBy: args.createdBy ?? null,
      postings: {
        create: args.lines.map((l) => ({ account: l.account, amount: l.amount, orderId: l.orderId ?? null, driverId: l.driverId ?? null })),
      },
    },
  })
  return true
}

// The balance of an account (debit +, credit -), optionally for one order or one driver.
export async function balance(tx: Tx, account: Account, where: { orderId?: string; driverId?: string } = {}): Promise<number> {
  const r = await tx.posting.aggregate({ where: { account, ...where }, _sum: { amount: true } })
  return r._sum.amount ?? 0
}

// What a refund on this order can draw on (lib/accounts.ts allocateRefund).
export async function orderPosition(tx: Tx, orderId: string, driverId: string | null) {
  const [held, income, earned, feeJournal] = await Promise.all([
    balance(tx, ACCOUNTS.customerFundsHeld, { orderId }),
    balance(tx, ACCOUNTS.platformFeeIncome, { orderId }),
    driverId ? balance(tx, ACCOUNTS.driverPayable, { orderId, driverId }) : Promise.resolve(0),
    tx.journal.count({ where: { orderId, event: { in: ['fee_income', 'attempt'] } } }),
  ])
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { platformFeePesewas: true } })
  return {
    held: -held, // money held for the order (credit balance)
    feeIncome: -income, // platform fee counted as income and not given back
    driverEarned: -earned, // what the driver earned on the order, after anything taken back
    // The platform fee is still inside the held money until the job finishes (or an attempt fee was charged).
    feeNotYetIncome: feeJournal > 0 ? 0 : order?.platformFeePesewas ?? 0,
  }
}
