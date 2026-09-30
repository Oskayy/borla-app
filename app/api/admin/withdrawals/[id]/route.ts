import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { createMomoRecipient, initiateTransfer, verifyTransfer } from '@/lib/paystack'
import { notifyUser } from '@/lib/notify'

// Finance acts on a withdrawal request:
//   send       -> sends the money to the driver's MoMo wallet through Paystack
//   mark_paid  -> the money was sent some other way (e.g. by hand from the MoMo app); a reference is required
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
      await prisma.withdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAID', paidAt: new Date(), note: null } })
      await notifyUser(w.driverId, {
        title: 'Earnings sent',
        body: `GHS ${w.amount.toFixed(2)} was sent to your ${w.momoProvider} wallet ${w.momoNumber}.`,
        url: '/dashboard/driver/earnings',
        sms: `Borla: GHS ${w.amount.toFixed(2)} has been sent to your MoMo wallet ${w.momoNumber}.`,
      })
      return NextResponse.json({ success: true, status: 'PAID' })
    }
    if (['failed', 'reversed', 'abandoned', 'rejected', 'blocked'].includes(s)) {
      await prisma.withdrawal.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'FAILED', note: `Paystack: transfer ${s}` } })
      return NextResponse.json({ success: true, status: 'FAILED' })
    }
    return NextResponse.json({ success: true, status: 'PROCESSING', paystackStatus: s })
  }

  if (w.status !== 'REQUESTED') {
    return NextResponse.json({ error: `This withdrawal is already ${w.status.toLowerCase()}` }, { status: 409 })
  }
  const amountLabel = `GHS ${w.amount.toFixed(2)}`

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
      body: `Your withdrawal of ${amountLabel} was not approved: ${note}. The money is back in your Borla balance.`,
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
      data: { status: 'PAID', method: 'manual', note, reviewedBy: auth.user.id, reviewedAt: new Date(), paidAt: new Date() },
    })
    if (moved.count !== 1) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })
    await logAdminAction(auth.user.id, 'WITHDRAWAL_MARKED_PAID', id, `${amountLabel}, reference ${note}`)
    await notifyUser(w.driverId, {
      title: 'Earnings sent',
      body: `${amountLabel} was sent to your ${w.momoProvider} wallet ${w.momoNumber}.`,
      url: '/dashboard/driver/earnings',
      sms: `Borla: ${amountLabel} has been sent to your MoMo wallet ${w.momoNumber}. Ref ${note}.`,
    })
    return NextResponse.json({ success: true, status: 'PAID' })
  }

  if (action !== 'send') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  // Claim it first, so two people pressing Send can't pay twice.
  const claimed = await prisma.withdrawal.updateMany({
    where: { id, status: 'REQUESTED' },
    data: { status: 'PROCESSING', method: 'paystack', reviewedBy: auth.user.id, reviewedAt: new Date() },
  })
  if (claimed.count !== 1) return NextResponse.json({ error: 'This withdrawal was just updated. Please refresh.' }, { status: 409 })

  // Paystack clearly refused (nothing was sent): undo the claim so finance can retry or pay by hand.
  async function backToRequested(reason: string) {
    await prisma.withdrawal.update({ where: { id }, data: { status: 'REQUESTED', method: null, note: reason } })
    await logAdminAction(auth.user.id, 'WITHDRAWAL_SEND_FAILED', id, `${amountLabel}: ${reason}`)
    return NextResponse.json({ error: `Paystack could not send it: ${reason}. You can try again, or pay by hand and mark it paid.` }, { status: 502 })
  }

  // The Paystack recipient for this wallet (created once per number and network).
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: w.driverId },
    select: { paystackRecipientCode: true, recipientFor: true },
  })
  const walletKey = `${w.momoProvider}:${w.momoNumber}`
  let recipient = profile?.recipientFor === walletKey ? profile.paystackRecipientCode : null
  if (!recipient) {
    const r = await createMomoRecipient({ name: w.momoName, number: w.momoNumber, provider: w.momoProvider })
    if (!r.ok) return backToRequested(r.error)
    recipient = r.data.recipient_code as string
    await prisma.driverProfile.update({ where: { userId: w.driverId }, data: { paystackRecipientCode: recipient, recipientFor: walletKey } })
  }

  const t = await initiateTransfer({ amountGhs: w.amount, recipient: recipient!, reference: w.reference, reason: 'Borla driver earnings' })
  if (!t.ok && t.uncertain) {
    // No clear answer: the money may have gone out. Keep it "being sent" (never back to REQUESTED, where it could be
    // paid by hand as well) until Paystack's webhook arrives or someone presses Check.
    await prisma.withdrawal.update({ where: { id }, data: { note: `No answer from Paystack (${t.error}). Press Check in a few minutes.` } })
    await logAdminAction(auth.user.id, 'WITHDRAWAL_SEND_UNCERTAIN', id, `${amountLabel}: ${t.error}`)
    return NextResponse.json({ success: true, status: 'PROCESSING', paystackStatus: 'unknown' })
  }
  if (!t.ok) return backToRequested(t.error)

  const status = t.data?.status
  const transferCode = typeof t.data?.transfer_code === 'string' ? t.data.transfer_code : null
  if (status === 'success') {
    await prisma.withdrawal.update({ where: { id }, data: { status: 'PAID', transferCode, paidAt: new Date() } })
    await notifyUser(w.driverId, {
      title: 'Earnings sent',
      body: `${amountLabel} was sent to your ${w.momoProvider} wallet ${w.momoNumber}.`,
      url: '/dashboard/driver/earnings',
      sms: `Borla: ${amountLabel} has been sent to your MoMo wallet ${w.momoNumber}.`,
    })
  } else {
    await prisma.withdrawal.update({
      where: { id },
      data: {
        transferCode,
        note: status === 'otp' ? 'Paystack is waiting for an OTP. Turn off "Confirm transfers before sending" in Paystack settings.' : null,
      },
    })
  }
  await logAdminAction(auth.user.id, 'WITHDRAWAL_SENT', id, `${amountLabel} via Paystack (${status ?? 'unknown'})`)
  return NextResponse.json({ success: true, status: status === 'success' ? 'PAID' : 'PROCESSING', paystackStatus: status })
}
