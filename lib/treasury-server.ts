import { prisma } from '@/lib/prisma'
import { getBalancePesewas } from '@/lib/paystack'
import { getWalletState, PAYOUT_ROLES } from '@/lib/wallet-server'
import { OPEN_WITHDRAWAL_STATUSES, payoutHoldEndsAt } from '@/lib/wallet'
import { EARNING_TYPES } from '@/lib/earnings'
import { planSweep, sweepTotal, topUpCheck, type PayoutCandidate } from '@/lib/treasury'
import { createWithdrawal, sendClaimedWithdrawal } from '@/lib/payouts-server'
import { notifyUsers } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { getPaystackTransfers } from '@/lib/settings'

const ghs = (p: number) => `GHS ${(p / 100).toFixed(2)}`

async function tellFinance(title: string, body: string) {
  const staff = await prisma.user.findMany({ where: { role: { in: PAYOUT_ROLES }, active: true }, select: { id: true } })
  await notifyUsers(
    staff.map((s: { id: string }) => s.id),
    { title, body, url: '/ops/finance' }
  )
}

// Every approved driver who could be paid today, with what they have available.
export async function payoutCandidates(now = new Date()): Promise<PayoutCandidate[]> {
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER', active: true, driverProfile: { is: { approvalStatus: 'APPROVED' } } },
    select: {
      id: true,
      driverProfile: { select: { momoNumber: true, momoChangedAt: true } },
      withdrawals: { where: { status: { in: OPEN_WITHDRAWAL_STATUSES } }, select: { id: true }, take: 1 },
    },
  })
  const out: PayoutCandidate[] = []
  for (const d of drivers) {
    const wallet = await getWalletState(d.id, prisma, now)
    out.push({
      driverId: d.id,
      available: wallet.available,
      hasWallet: !!d.driverProfile?.momoNumber,
      openWithdrawal: d.withdrawals.length > 0,
      walletChangedRecently: !!payoutHoldEndsAt(d.driverProfile?.momoChangedAt ?? null, now),
    })
  }
  return out
}

// The most drivers earned in one day over the last 14 days (headroom for the Paystack balance).
async function biggestNight(now: Date): Promise<number> {
  const since = new Date(now.getTime() - 14 * 86_400_000)
  const rows = await prisma.$queryRaw<{ total: bigint | null }[]>`
    SELECT SUM("amountPesewas") AS total FROM "LedgerEntry"
    WHERE "type" = ANY(${EARNING_TYPES}) AND "createdAt" >= ${since}
    GROUP BY date_trunc('day', "createdAt") ORDER BY total DESC LIMIT 1`
  return Number(rows[0]?.total ?? 0)
}

// 7am: how much the Paystack balance needs for today's payouts; Finance is told the exact top-up if it's short.
export async function morningTopUpCheck(day: string): Promise<string> {
  if (!(await getPaystackTransfers())) return 'Paystack transfers are off: payouts are paid by hand, no top-up needed'
  const now = new Date()
  const plan = planSweep(await payoutCandidates(now))
  const total = sweepTotal(plan)
  const [balance, night] = await Promise.all([getBalancePesewas(), biggestNight(now)])
  const check = topUpCheck({ due: total.amount, transfers: plan.auto.length, balance, biggestNight: night })
  await prisma.treasuryCheck.upsert({
    where: { day },
    create: {
      day,
      drivers: plan.auto.length,
      duePesewas: check.due,
      feesPesewas: check.fees,
      bufferPesewas: check.buffer,
      balancePesewas: balance,
      topUpPesewas: check.topUp,
    },
    update: {},
  })
  if (check.topUp > 0) {
    await tellFinance(
      'Top up the Paystack balance',
      `Add ${ghs(check.topUp)} before 10am: ${plan.auto.length} driver payout(s) of ${ghs(check.due)} plus fees and headroom need ${ghs(check.needed)}` +
        (balance == null ? ', and Paystack did not report the balance.' : `; the balance is ${ghs(balance)}.`)
    )
  }
  return `due ${ghs(check.due)} to ${plan.auto.length} driver(s), balance ${balance == null ? 'unknown' : ghs(balance)}, top-up ${ghs(check.topUp)}`
}

// 10am onwards: pays every driver their available balance in one transfer. It never starts payouts it can't
// finish: if the Paystack balance doesn't cover them all, nothing is sent and it tries again on the next run.
// Returns done=false to be retried.
export async function runDailySweep(): Promise<{ done: boolean; summary: string }> {
  const sweep = planSweep(await payoutCandidates())
  // Paystack transfers switched off (Finance page): nothing is sent; every payout waits for Finance to pay by hand.
  const transfers = await getPaystackTransfers()
  const plan = transfers
    ? sweep
    : { auto: [], forFinance: [...sweep.auto.map((p) => ({ ...p, why: 'Paystack transfers are off: pay by hand' })), ...sweep.forFinance] }
  const total = sweepTotal(plan)
  if (plan.auto.length > 0) {
    const balance = await getBalancePesewas()
    if (balance == null || balance < total.amount + total.fees) {
      return { done: false, summary: `waiting: needs ${ghs(total.amount + total.fees)}, balance ${balance == null ? 'unknown' : ghs(balance)}` }
    }
  }

  let sent = 0
  let waiting = 0
  const problems: string[] = []
  for (const p of plan.auto) {
    try {
      const w = await createWithdrawal({ driverId: p.driverId, amountPesewas: p.amount, source: 'sweep', claim: true })
      const r = await sendClaimedWithdrawal(w.id)
      if (r.ok) sent++
      else problems.push(`${ghs(p.amount)}: ${'error' in r ? r.error : 'not sent'}`)
    } catch (err) {
      const e = caught(err)
      // Something changed since the plan (a cash-out, a refund): that driver is simply paid tomorrow.
      if (e?.message !== 'OPEN_REQUEST' && !String(e?.message).startsWith('INVALID:')) problems.push(String(e?.message ?? e))
    }
  }
  for (const p of plan.forFinance) {
    try {
      await createWithdrawal({ driverId: p.driverId, amountPesewas: p.amount, source: 'sweep', claim: false, note: `Daily payout waiting for Finance: ${p.why}` })
      waiting++
    } catch {
      // as above: tomorrow
    }
  }
  if (sent + waiting > 0 || problems.length) {
    await tellFinance(
      'Daily driver payouts',
      `${sent} payout(s) of ${ghs(total.amount)} sent` +
        (waiting ? `; ${waiting} waiting for you on the Withdrawals page` : '') +
        (problems.length ? `; ${problems.length} could not be sent: ${problems.slice(0, 3).join('; ')}` : '') +
        '.'
    )
  }
  return { done: true, summary: `${sent} sent, ${waiting} for Finance, ${problems.length} problem(s)` }
}
