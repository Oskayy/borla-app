import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { verifyTransfer } from '@/lib/paystack'
import { notifyUser, notifyUsers } from '@/lib/notify'
import { markWithdrawalPaid, sendClaimedWithdrawal } from '@/lib/payouts-server'
import { getPaystackTransfers } from '@/lib/settings'

// Finance acts on a withdrawal request:
//   send       -> sends the money to the driver's MoMo wallet through Paystack
///   mark_paid  -> the money was sent some other way (e.g. by hand from the MoMo app); a reference is required.
//                 It then waits (CONFIRMING) until a different finance user checks the payment:
//   confirm_paid -> second person: the payment is there; the withdrawal is PAID and the driver is told
//   dispute_paid -> second person: can't find the payment; back to REQUESTED with a note
//   reject     -> refused, with a note the driver can see; the amount goes back to their balance
//   check      -> asks Paystack what happened to a transfer that is still "being sent" (e.g. after a timeout)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PAYOUT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'withdrawal_action', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid withdrawal' }, { status: 400 })
  const body = await readJson(req)
  const action = body?.action
  const note = cleanText(body?.note, 200)

  const w = await prisma.withdrawal.findUnique({ where: { id } })
  if (!w) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })

  if (action === 'check') {
    if (w.status !== 'PROCESSING' || w.method !== 'paystack') {
      return NextResponse.json({ error: 'Only transfers being sent through Paystack can be checked' }, { status: 409 })
    }
    const v = await verifyTransfer(w.reference)
    if (v.notFound) {
      // Paystack never got it: safe to send again or pay by hand.
      await prisma.withdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'REQUESTED', method: null, note: 'Paystack has no record of this transfer. Safe to send again.' } })
      return NextResponse.json({ success: true, status: 'REQUESTED' })
    }
    if (!v.ok) return NextResponse.json({ error: `Couldn't check with Paystack: ${v.error}. Try again shortly.` }, { status: 502 })
    const s = v.data?.status
    if (s === 'success') {
      await markWithdrawalPaid(id, ['PROCESSING'], { transferCode: typeof v.data?.transfer_code === 'string' ? v.data.transfer_code : undefined })
      return NextResponse.json({ success: true, status: 'PAID' })
    }
    if (['failed', 'reversed', 'abandoned', 'rejected', 'blocked'].includes(s)) {
      await prisma.withdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'FAILED', note: `Paystack: transfer ${s}` } })
      return NextResponse.json({ success: true, status: 'FAILED' })
    }
    return NextResponse.json({ success: true, status: 'PROCESSING', paystackStatus: s })
  }

  const amountLabel = `GHS ${w.amount.toFixed(2)}`

  if (action === 'confirm_paid' || action === 'dispute_paid') {
    if (w.status !== 'CONFIRMING') return NextResponse.json({ error: 'This withdrawal is not waiting for confirmation' }, { status: 409 })
    if (w.markedPaidBy === auth.user.id) {
      return NextResponse.json({ error: 'A different finance team member must check a payment you recorded' }, { status: 403 })
    }
    if (action === 'dispute_paid') {
      if (!note || note.length < 3) return NextResponse.json({ error: 'Please say what you found' }, { status: 400 })
      const moved = await prisma.withdrawal.updateMany({
        where: { id, status: 'CONFIRMING', markedPaidBy: w.markedPaidBy },
        data: { status: 'REQUESTED', method: null, markedPaidBy: null, markedPaidAt: null, note: `Manual payment "${w.note}" not confirmed: ${note}` },
      })
      if (moved.count !== 1) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })
      await logAdminAction(auth.user.id, 'WITHDRAWAL_MANUAL_DISPUTED', id, `${amountLabel}, reference ${w.note}: ${note}`)
      return NextResponse.json({ success: true, status: 'REQUESTED' })
    }
    // Paid by hand from the bank: recorded in the ledger as a bank payment.
    const paid = await markWithdrawalPaid(id, ['CONFIRMING'], { reviewedBy: auth.user.id, paidAt: w.markedPaidAt ?? new Date() })
    if (!paid) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })
    await logAdminAction(auth.user.id, 'WITHDRAWAL_MANUAL_CONFIRMED', id, `${amountLabel}, reference ${w.note}`)
    return NextResponse.json({ success: true, status: 'PAID' })
  }

  if (w.status !== 'REQUESTED') {
    return NextResponse.json({ error: `This withdrawal is already ${w.status.toLowerCase()}` }, { status: 409 })
  }

  if (action === 'reject') {
    if (!note || note.length < 3) return NextResponse.json({ error: 'Please give a reason' }, { status: 400 })
    const moved = await prisma.withdrawal.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: 'REJECTED', note, reviewedBy: auth.user.id, reviewedAt: new Date() },
    })
    if (moved.count !== 1) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })
    await logAdminAction(auth.user.id, 'WITHDRAWAL_REJECTED', id, `${amountLabel}: ${note}`)
    await notifyUser(w.driverId, {
      title: 'Withdrawal not sent',
      body: `Your withdrawal of ${amountLabel} was not approved: ${note}. The money is back in your Trashit balance.`,
      url: '/dashboard/driver/earnings',
    })
    return NextResponse.json({ success: true, status: 'REJECTED' })
  }

  if (action === 'mark_paid') {
    if (!note || note.length < 4) {
      return NextResponse.json({ error: 'Please enter the MoMo transaction ID or reference of the payment you made' }, { status: 400 })
    }
    const moved = await prisma.withdrawal.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: 'CONFIRMING', method: 'manual', note, markedPaidBy: auth.user.id, markedPaidAt: new Date() },
    })
    if (moved.count !== 1) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })
    await logAdminAction(auth.user.id, 'WITHDRAWAL_MARKED_PAID', id, `${amountLabel}, reference ${note} (waiting for a second check)`)
    const others = await prisma.user.findMany({
      where: { role: { in: PAYOUT_ROLES }, active: true, id: { not: auth.user.id } },
      select: { id: true },
    })
    await notifyUsers(
      others.map((s: { id: string }) => s.id),
      { title: 'Payment to confirm', body: `Please check a manual payment of ${amountLabel} (reference ${note}) and confirm it.`, url: '/ops/withdrawals' }
    )
    return NextResponse.json({ success: true, status: 'CONFIRMING' })
  }

  if (action !== 'send') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  if (!(await getPaystackTransfers())) {
    return NextResponse.json(
      { error: 'Paystack transfers are switched off on the Finance page. Pay from your MoMo business wallet and use Mark paid.' },
      { status: 409 }
    )
  }

  // Claim it first, so two people pressing Send can't pay twice.
  const claimed = await prisma.withdrawal.updateMany({
    where: { id, status: 'REQUESTED' },
    data: { status: 'PROCESSING', method: 'paystack', reviewedBy: auth.user.id, reviewedAt: new Date() },
  })
  if (claimed.count !== 1) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })

  const sent = await sendClaimedWithdrawal(id)
  if (!sent.ok && 'error' in sent) {
    // Paystack clearly refused (nothing was sent): it's back to REQUESTED so finance can retry or pay by hand.
    await logAdminAction(auth.user.id, 'WITHDRAWAL_SEND_FAILED', id, `${amountLabel}: ${sent.error}`)
    return NextResponse.json({ error: `Paystack could not send it: ${sent.error}. You can try again, or pay by hand and mark it paid.` }, { status: 502 })
  }
  await logAdminAction(auth.user.id, 'WITHDRAWAL_SENT', id, `${amountLabel} via Paystack (${sent.paystackStatus ?? 'no answer yet'})`)
  return NextResponse.json({ success: true, status: sent.status, paystackStatus: sent.paystackStatus ?? 'unknown' })
}
