import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { checkWithdrawal, transferReference } from '@/lib/wallet'
import { getWalletSummary, PAYOUT_ROLES } from '@/lib/wallet-server'
import { notifyUsers } from '@/lib/notify'

// A driver asks for (part of) their balance to be sent to their mobile money wallet.
// Finance approves it on the Withdrawals page, which sends the money through Paystack.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'withdrawal_request', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const amount = (await readJson(req))?.amount
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { momoNumber: true, momoProvider: true, momoName: true, approvalStatus: true },
  })
  if (!profile?.momoNumber || !profile.momoProvider || !profile.momoName) {
    return NextResponse.json({ error: 'Please add your mobile money wallet first' }, { status: 400 })
  }
  if (profile.approvalStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Your account must be approved before you can withdraw' }, { status: 403 })
  }

  let created: { id: string; amount: number } | null = null
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const open = await tx.withdrawal.count({ where: { driverId: auth.user.id, status: { in: ['REQUESTED', 'PROCESSING'] } } })
        if (open > 0) throw new Error('OPEN_REQUEST')
        const wallet = await getWalletSummary(auth.user.id, tx)
        const problem = checkWithdrawal(amount, wallet.available)
        if (problem) throw new Error(`INVALID:${problem}`)
        const w = await tx.withdrawal.create({
          data: {
            driverId: auth.user.id,
            amount,
            momoNumber: profile.momoNumber!,
            momoProvider: profile.momoProvider!,
            momoName: profile.momoName!,
            reference: `pending-${crypto.randomUUID()}`, // replaced with the real reference below
          },
        })
        return tx.withdrawal.update({ where: { id: w.id }, data: { reference: transferReference(w.id) }, select: { id: true, amount: true } })
      },
      { isolationLevel: 'Serializable', timeout: 15000 }
    )
  } catch (e: any) {
    if (e?.message === 'OPEN_REQUEST') {
      return NextResponse.json({ error: 'You already have a withdrawal waiting. Please wait for it to finish.' }, { status: 409 })
    }
    if (typeof e?.message === 'string' && e.message.startsWith('INVALID:')) {
      return NextResponse.json({ error: e.message.slice(8) }, { status: 400 })
    }
    if (e?.code === 'P2034') {
      return NextResponse.json({ error: 'Please try again in a moment.' }, { status: 409 })
    }
    console.error('[withdrawals] request failed', e)
    return NextResponse.json({ error: 'Could not request the withdrawal. Please try again.' }, { status: 500 })
  }

  const staff = await prisma.user.findMany({ where: { role: { in: PAYOUT_ROLES as any }, active: true }, select: { id: true } })
  await notifyUsers(
    staff.map((s: { id: string }) => s.id),
    { title: 'Withdrawal request', body: `A driver asked to withdraw GHS ${created!.amount.toFixed(2)}.`, url: '/ops/withdrawals' }
  )
  return NextResponse.json({ success: true, id: created!.id })
}
