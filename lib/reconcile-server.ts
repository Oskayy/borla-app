import { prisma } from '@/lib/prisma'
import { getBalancePesewas, listSettlements, listSuccessfulTransactions } from '@/lib/paystack'
import { ACCOUNTS, TRANSFER_FEE_PESEWAS } from '@/lib/accounts'
import { compareBalance, compareDrivers, compareFees, comparePayments, mustBeZero, SETTLEMENT_CONFIRM_DAYS, type CheckResult } from '@/lib/reconcile'
import { getWalletState, PAYOUT_ROLES } from '@/lib/wallet-server'
import { amountSent } from '@/lib/payouts-server'
import { notifyUsers } from '@/lib/notify'
import { zonedInstant } from '@/lib/offers'

const PAYMENT_STATUSES = ['success', 'amount_mismatch', 'partially_refunded', 'refunded']

// Copies Paystack's settlements (last 14 days) so Finance can confirm each one reached the bank.
export async function syncSettlements(now = new Date()): Promise<number> {
  const rows = await listSettlements(new Date(now.getTime() - 14 * 86_400_000), now)
  if (!rows) return 0
  let added = 0
  for (const s of rows) {
    const exists = await prisma.paystackSettlement.findUnique({ where: { paystackId: s.id }, select: { id: true } })
    if (exists) {
      await prisma.paystackSettlement.update({ where: { paystackId: s.id }, data: { status: s.status } })
      continue
    }
    await prisma.paystackSettlement.create({
      data: { paystackId: s.id, status: s.status, amountPesewas: s.amount, settledAt: s.settledAt ? new Date(s.settledAt) : now },
    })
    added++
  }
  return added
}

// Checks one day (YYYY-MM-DD, Accra) of the app's money against Paystack and the ledger, and keeps the result.
export async function reconcileDay(day: string, timezone: string): Promise<{ ok: boolean; results: CheckResult[] }> {
  const from = zonedInstant(day, 0, timezone)
  const to = new Date(from.getTime() + 86_400_000)
  const results: CheckResult[] = []

  // 1-2. Payments and Paystack's fees on them.
  const [appPayments, paystack] = await Promise.all([
    prisma.payment.findMany({ where: { createdAt: { gte: from, lt: to }, status: { in: PAYMENT_STATUSES } }, select: { providerRef: true, amount: true } }),
    listSuccessfulTransactions(from, to),
  ])
  if (paystack) {
    results.push(comparePayments(appPayments.map((p) => ({ reference: p.providerRef, amount: Math.round(p.amount * 100) })), paystack))
    const feeJournals = await prisma.journal.findMany({
      where: { key: { in: paystack.map((t) => `payment-fee-${t.reference}`) } },
      select: { key: true, postings: { where: { account: ACCOUNTS.paymentFees }, select: { amount: true } } },
    })
    const ledgerFees = new Map(feeJournals.map((j) => [j.key.slice('payment-fee-'.length), j.postings.reduce((s, p) => s + p.amount, 0)]))
    results.push(compareFees(ledgerFees, paystack))
  } else {
    results.push({ name: 'Payments', ok: false, summary: 'Paystack did not answer, so payments could not be checked', details: [] })
  }

  // 3. The Paystack balance, allowing for payouts Paystack has taken but not yet confirmed.
  const [ledgerBalance, inFlightRows, balance] = await Promise.all([
    prisma.posting.aggregate({ where: { account: ACCOUNTS.paystackBalance }, _sum: { amount: true } }),
    prisma.withdrawal.findMany({ where: { status: 'PROCESSING', method: 'paystack' }, select: { amount: true, feePesewas: true, withholdingPesewas: true } }),
    getBalancePesewas(),
  ])
  const inFlight = inFlightRows.reduce((s, w) => s + Math.round(amountSent(w) * 100) + TRANSFER_FEE_PESEWAS, 0)
  results.push(compareBalance({ ledger: ledgerBalance._sum.amount ?? 0, inFlight, paystack: balance }))

  // 4. The ledger itself: every journal balances; finished orders hold nothing; splits add up.
  const [unbalanced] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (SELECT "journalId" FROM "Posting" GROUP BY "journalId" HAVING SUM("amount") <> 0) x`
  results.push(mustBeZero('Ledger', Number(unbalanced?.n ?? 0), 'unbalanced journals'))
  const [stillHeld] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (
      SELECT p."orderId" FROM "Posting" p JOIN "Order" o ON o."id" = p."orderId"
      WHERE p."account" = 'customer_funds_held' AND o."status" IN ('COMPLETED', 'CANCELLED')
      GROUP BY p."orderId" HAVING SUM(p."amount") <> 0) x`
  results.push(mustBeZero('Finished orders', Number(stillHeld?.n ?? 0), 'finished or cancelled orders still holding customer money'))

  // 5. Each driver's balance in the ledger vs their wallet.
  const owed = await prisma.posting.groupBy({ by: ['driverId'], where: { account: ACCOUNTS.driverPayable, driverId: { not: null } }, _sum: { amount: true } })
  const drivers: { driverId: string; ledger: number; wallet: number }[] = []
  for (const o of owed) {
    const w = await getWalletState(o.driverId!)
    drivers.push({ driverId: o.driverId!, ledger: -(o._sum.amount ?? 0), wallet: w.earned - w.paidOut })
  }
  results.push(compareDrivers(drivers))

  // 6. Settlements Paystack sent that nobody has confirmed arrived in the bank.
  const late = await prisma.paystackSettlement.count({
    where: { confirmedAt: null, status: 'success', settledAt: { lt: new Date(Date.now() - SETTLEMENT_CONFIRM_DAYS * 86_400_000) } },
  })
  results.push(mustBeZero('Settlements', late, `settlement(s) not confirmed as received after ${SETTLEMENT_CONFIRM_DAYS} days`))

  const ok = results.every((r) => r.ok)
  await prisma.reconciliationRun.upsert({
    where: { day },
    create: { day, ok, results: JSON.parse(JSON.stringify(results)) },
    update: { ok, results: JSON.parse(JSON.stringify(results)), reviewedBy: null, reviewedAt: null, reviewNote: null },
  })
  if (!ok) {
    const staff = await prisma.user.findMany({ where: { role: { in: PAYOUT_ROLES }, active: true }, select: { id: true } })
    await notifyUsers(
      staff.map((s: { id: string }) => s.id),
      {
        title: 'Money check found differences',
        body: `${results.filter((r) => !r.ok).map((r) => r.name).join(', ')} for ${day}. See the Finance page.`,
        url: '/ops/finance',
      }
    )
  }
  return { ok, results }
}
