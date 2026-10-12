import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { payoutHoldEndsAt } from '@/lib/wallet'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { notifyUsers } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { cashOutFee, cashOutIsInstant } from '@/lib/treasury'
import { createWithdrawal, sendClaimedWithdrawal } from '@/lib/payouts-server'
import { getBalancePesewas } from '@/lib/paystack'
import { getPaystackTransfers, getShiftSettings } from '@/lib/settings'
import { localParts } from '@/lib/shift'
import { zonedInstant } from '@/lib/offers'

// "Cash out now": a driver asks for (part of) their available balance (the rest is paid in the 10am daily sweep).
// The first cash-out each day is free; later ones pay the GHS 1 transfer fee out of the amount. Up to GHS 500 it is
// sent straight away through Paystack when the balance covers it; otherwise Finance sends it from the Withdrawals page.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'withdrawal_request', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const amount = (await readJson(req))?.amount
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { momoNumber: true, momoProvider: true, momoName: true, approvalStatus: true, momoChangedAt: true },
  })
  if (!profile?.momoNumber || !profile.momoProvider || !profile.momoName) {
    return NextResponse.json({ error: 'Please add your mobile money wallet first' }, { status: 400 })
  }
  if (profile.approvalStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Your account must be approved before you can withdraw' }, { status: 403 })
  }
  const holdEnds = payoutHoldEndsAt(profile.momoChangedAt, new Date())
  if (holdEnds) {
    const when = holdEnds.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', hour: 'numeric', minute: '2-digit' })
    return NextResponse.json(
      { error: `Your payout wallet was changed recently, so withdrawals are paused until ${when} for your safety.` },
      { status: 403 }
    )
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount)) return NextResponse.json({ error: 'Please enter an amount' }, { status: 400 })
  const amountPesewas = Math.round(amount * 100)

  // Free once a day (Accra time), then the GHS 1 transfer fee.
  const settings = await getShiftSettings()
  const today = zonedInstant(localParts(new Date(), settings.timezone).date, 0, settings.timezone)
  const cashOutsToday = await prisma.withdrawal.count({
    where: { driverId: auth.user.id, source: 'cashout', requestedAt: { gte: today }, status: { notIn: ['FAILED', 'REJECTED'] } },
  })
  const fee = cashOutFee(cashOutsToday)
  const instant =
    (await getPaystackTransfers()) && cashOutIsInstant(amountPesewas, fee, amountPesewas <= 50_000 ? await getBalancePesewas() : null)

  let created: { id: string; amount: number } | null = null
  try {
    created = await createWithdrawal({ driverId: auth.user.id, amountPesewas, source: 'cashout', feePesewas: fee, claim: instant })
  } catch (err) {
    const e = caught(err)
    if (e?.message === 'OPEN_REQUEST') {
      return NextResponse.json({ error: 'You already have a withdrawal waiting. Please wait for it to finish.' }, { status: 409 })
    }
    if (typeof e?.message === 'string' && e.message.startsWith('INVALID:')) {
      return NextResponse.json({ error: e.message.slice(8) }, { status: 400 })
    }
    if (e?.message === 'NO_WALLET') return NextResponse.json({ error: 'Please add your mobile money wallet first' }, { status: 400 })
    if (e?.code === 'P2034') {
      return NextResponse.json({ error: 'Please try again in a moment.' }, { status: 409 })
    }
    console.error('[withdrawals] request failed', e)
    return NextResponse.json({ error: 'Could not request the withdrawal. Please try again.' }, { status: 500 })
  }

  if (instant) {
    const sent = await sendClaimedWithdrawal(created!.id)
    if (sent.ok) return NextResponse.json({ success: true, id: created!.id, status: sent.status, fee: fee / 100 })
    // Paystack refused it: it's back with Finance (REQUESTED), as below.
  }
  const staff = await prisma.user.findMany({ where: { role: { in: PAYOUT_ROLES }, active: true }, select: { id: true } })
  await notifyUsers(
    staff.map((s: { id: string }) => s.id),
    { title: 'Cash-out to send', body: `A driver asked to cash out GHS ${created!.amount.toFixed(2)}.`, url: '/ops/withdrawals' }
  )
  return NextResponse.json({ success: true, id: created!.id, status: 'REQUESTED', fee: fee / 100 })
}
