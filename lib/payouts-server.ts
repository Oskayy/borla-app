import { prisma } from '@/lib/prisma'
import { createMomoRecipient, initiateTransfer } from '@/lib/paystack'
import { notifyUser } from '@/lib/notify'
import { postJournal } from '@/lib/journal-server'
import { payoutLines, reverseLines } from '@/lib/accounts'
import { checkWithdrawal, OPEN_WITHDRAWAL_STATUSES, transferReference } from '@/lib/wallet'
import { getWalletSummary } from '@/lib/wallet-server'
import { getTaxRates } from '@/lib/settings'
import { withholding } from '@/lib/tax'

// Driver payouts (withdrawals), shared by Finance's Send button, the daily sweep and "Cash out now".
// Paying a withdrawal and its ledger journal happen in one transaction, so money can't leave the books twice
// or not at all.

type W = { id: string; driverId: string; amount: number; feePesewas: number; withholdingPesewas: number; method: string | null; momoProvider: string; momoNumber: string }

const lines = (w: W) =>
  payoutLines({
    driverId: w.driverId,
    amount: Math.round(w.amount * 100),
    driverFee: w.feePesewas,
    withholding: w.withholdingPesewas,
    method: w.method === 'manual' ? 'manual' : 'paystack',
  })

// What reaches the driver's wallet (an extra cash-out pays the transfer fee out of it; any tax withheld too).
export function amountSent(w: { amount: number; feePesewas: number; withholdingPesewas?: number }): number {
  return (Math.round(w.amount * 100) - w.feePesewas - (w.withholdingPesewas ?? 0)) / 100
}

// Marks a withdrawal PAID (if it is still in one of `from`) and records the payout in the ledger.
// Returns false when someone else already moved it on.
export async function markWithdrawalPaid(id: string, from: string[], data: { transferCode?: string | null; reviewedBy?: string; paidAt?: Date } = {}): Promise<boolean> {
  const done = await prisma.$transaction(async (tx) => {
    const moved = await tx.withdrawal.updateMany({
      where: { id, status: { in: from } },
      data: {
        status: 'PAID',
        paidAt: data.paidAt ?? new Date(),
        note: null,
        ...(data.transferCode !== undefined ? { transferCode: data.transferCode } : {}),
        ...(data.reviewedBy ? { reviewedBy: data.reviewedBy, reviewedAt: new Date() } : {}),
      },
    })
    if (moved.count !== 1) return null
    const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } })
    await postJournal(tx, { key: `payout-${id}`, event: 'payout', driverId: w.driverId, lines: lines(w) })
    return w
  })
  if (!done) return false
  const sent = amountSent(done).toFixed(2)
  await notifyUser(done.driverId, {
    title: 'Earnings sent',
    body: `GHS ${sent} was sent to your ${done.momoProvider} wallet ${done.momoNumber}.`,
    url: '/dashboard/driver/earnings',
    sms: `Trashit: GHS ${sent} has been sent to your MoMo wallet ${done.momoNumber}.`,
  })
  return true
}

// Paystack reversed a payout it had reported as sent: the money is back in the driver's balance and the ledger
// entry is undone.
export async function markWithdrawalReversed(id: string, note: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const moved = await tx.withdrawal.updateMany({ where: { id, status: 'PAID', method: 'paystack' }, data: { status: 'FAILED', note } })
    if (moved.count !== 1) return false
    const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } })
    await postJournal(tx, { key: `payout-reversed-${id}`, event: 'payout_reversed', driverId: w.driverId, lines: reverseLines(lines(w)) })
    return true
  })
}

export type SendResult =
  | { ok: true; status: 'PAID' | 'PROCESSING'; paystackStatus: string | null }
  | { ok: false; retryable: true; error: string } // Paystack clearly refused: the withdrawal is back to REQUESTED

// Sends a withdrawal through Paystack. The caller must already have moved it to PROCESSING (claimed it), so two
// senders can never pay it twice. An unclear answer keeps it PROCESSING (never back to REQUESTED, where it could
// be paid again) until the webhook arrives or someone presses Check.
export async function sendClaimedWithdrawal(id: string): Promise<SendResult> {
  const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id } })
  const backToRequested = async (reason: string): Promise<SendResult> => {
    await prisma.withdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'REQUESTED', method: null, note: reason } })
    return { ok: false, retryable: true, error: reason }
  }

  // The Paystack recipient for this wallet (created once per number and network).
  const profile = await prisma.driverProfile.findUnique({ where: { userId: w.driverId }, select: { paystackRecipientCode: true, recipientFor: true } })
  const walletKey = `${w.momoProvider}:${w.momoNumber}`
  let recipient = profile?.recipientFor === walletKey ? profile.paystackRecipientCode : null
  if (!recipient) {
    const r = await createMomoRecipient({ name: w.momoName, number: w.momoNumber, provider: w.momoProvider })
    if (!r.ok) return backToRequested(r.error)
    recipient = r.data.recipient_code as string
    await prisma.driverProfile.update({ where: { userId: w.driverId }, data: { paystackRecipientCode: recipient, recipientFor: walletKey } })
  }

  const t = await initiateTransfer({ amountGhs: amountSent(w), recipient: recipient!, reference: w.reference, reason: 'Trashit driver earnings' })
  if (!t.ok && t.uncertain) {
    await prisma.withdrawal.update({ where: { id }, data: { note: `No answer from Paystack (${t.error}). Press Check in a few minutes.` } })
    return { ok: true, status: 'PROCESSING', paystackStatus: null }
  }
  if (!t.ok) return backToRequested(t.error)

  const status = typeof t.data?.status === 'string' ? (t.data.status as string) : null
  const transferCode = typeof t.data?.transfer_code === 'string' ? t.data.transfer_code : null
  if (status === 'success') {
    await markWithdrawalPaid(id, ['PROCESSING'], { transferCode })
    return { ok: true, status: 'PAID', paystackStatus: status }
  }
  await prisma.withdrawal.update({
    where: { id },
    data: {
      transferCode,
      note: status === 'otp' ? 'Paystack is waiting for an OTP. Turn off "Confirm transfers before sending" in Paystack settings.' : null,
    },
  })
  return { ok: true, status: 'PROCESSING', paystackStatus: status }
}

// Creates a withdrawal for a driver, checking in one serializable step that nothing else is on its way and the
// money is available (lib/earnings.ts), so two requests at the same moment can't spend the same balance.
// `claim`: create it already PROCESSING (about to be sent through Paystack) instead of waiting for Finance.
// Throws Error('OPEN_REQUEST' | 'NO_WALLET' | 'INVALID:<message>').
export async function createWithdrawal(args: {
  driverId: string
  amountPesewas: number
  source: 'request' | 'cashout' | 'sweep'
  feePesewas?: number
  claim: boolean
  note?: string | null
}): Promise<{ id: string; amount: number }> {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: args.driverId },
    select: { momoNumber: true, momoProvider: true, momoName: true },
  })
  if (!profile?.momoNumber || !profile.momoProvider || !profile.momoName) throw new Error('NO_WALLET')
  const amount = args.amountPesewas / 100
  // Tax withheld from the payout (0 until the accountant confirms a rate).
  const wht = withholding(args.amountPesewas, (await getTaxRates()).withholdingBps)
  return prisma.$transaction(
    async (tx) => {
      const open = await tx.withdrawal.count({ where: { driverId: args.driverId, status: { in: OPEN_WITHDRAWAL_STATUSES } } })
      if (open > 0) throw new Error('OPEN_REQUEST')
      const wallet = await getWalletSummary(args.driverId, tx)
      const problem = checkWithdrawal(amount, wallet.available)
      if (problem) throw new Error(`INVALID:${problem}`)
      if ((args.feePesewas ?? 0) + wht >= args.amountPesewas) throw new Error('INVALID:The amount must be more than the GHS 1 transfer fee')
      const w = await tx.withdrawal.create({
        data: {
          driverId: args.driverId,
          amount,
          momoNumber: profile.momoNumber!,
          momoProvider: profile.momoProvider!,
          momoName: profile.momoName!,
          source: args.source,
          feePesewas: args.feePesewas ?? 0,
          withholdingPesewas: wht,
          note: args.note ?? null,
          ...(args.claim ? { status: 'PROCESSING', method: 'paystack' } : {}),
          reference: `pending-${crypto.randomUUID()}`, // replaced with the real reference below
        },
      })
      return tx.withdrawal.update({ where: { id: w.id }, data: { reference: transferReference(w.id) }, select: { id: true, amount: true } })
    },
    { isolationLevel: 'Serializable', timeout: 15000 }
  )
}
