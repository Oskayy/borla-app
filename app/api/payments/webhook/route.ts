import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { refundStatusFromPaystack } from '@/lib/refunds'
import { markRefundProcessed } from '@/lib/refunds-server'
import { notifyOps, notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { markWithdrawalPaid, markWithdrawalReversed } from '@/lib/payouts-server'
import { confirmCharge } from '@/lib/payment-confirm-server'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    console.error('[webhook] PAYSTACK_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Confirm this really came from Paystack.
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Signed by Paystack but still checked field by field below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const name = typeof event?.event === 'string' ? event.event : ''
  try {
    if (name.startsWith('transfer.')) {
      await handleTransfer(name, event.data)
      return NextResponse.json({ received: true })
    }
    if (name.startsWith('refund.')) {
      await handleRefund(event.data)
      return NextResponse.json({ received: true })
    }
  } catch (e) {
    console.error(`[webhook] ${name} failed:`, e)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }) // Paystack will retry
  }

  if (name !== 'charge.success') {
    return NextResponse.json({ received: true })
  }

  // Recorded once, whether this message or a direct check with Paystack gets there first (lib/payment-confirm-server.ts).
  try {
    await confirmCharge(event.data, 'webhook')
  } catch (err) {
    console.error('[webhook] Database transaction failed:', caught(err))
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }) // Paystack will retry
  }
  return NextResponse.json({ received: true })
}

// Driver withdrawals: Paystack tells us whether the money reached the wallet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paystack event data, fields checked before use
async function handleTransfer(name: string, data: any) {
  const reference = data?.reference
  if (typeof reference !== 'string') return
  const w = await prisma.withdrawal.findUnique({ where: { reference } })
  if (!w || w.status === 'REJECTED' || w.status === 'FAILED') return
  const amountLabel = `GHS ${w.amount.toFixed(2)}`
  // A reversal can come after a success; anything else about a paid withdrawal is old news.
  if (w.status === 'PAID' && (name !== 'transfer.reversed' || w.method === 'manual')) return

  if (name === 'transfer.success') {
    await markWithdrawalPaid(w.id, ['PROCESSING', 'REQUESTED'], { transferCode: typeof data?.transfer_code === 'string' ? data.transfer_code : undefined })
  } else if (['transfer.failed', 'transfer.reversed', 'transfer.abandoned', 'transfer.rejected', 'transfer.blocked'].includes(name)) {
    // Failed money goes back into the driver's balance (FAILED withdrawals don't count against it). A payout that
    // had been recorded as paid is taken back out of the ledger too.
    const note = `Paystack: ${name === 'transfer.reversed' ? 'transfer reversed' : 'transfer failed'}${data?.reason ? ` (${String(data.reason).slice(0, 100)})` : ''}`
    if (w.status === 'PAID') {
      if (!(await markWithdrawalReversed(w.id, note))) return
    } else {
      await prisma.withdrawal.update({ where: { id: w.id }, data: { status: 'FAILED', note } })
    }
    await notifyUser(w.driverId, {
      title: 'Withdrawal failed',
      body: `We couldn't send ${amountLabel} to ${w.momoNumber}. The money is back in your Trashit balance. Please check your wallet details and try again.`,
      url: '/dashboard/driver/earnings',
    })
  }
}

// Customer refunds: Paystack reports progress until the money is back with the customer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paystack event data, fields checked before use
async function handleRefund(data: any) {
  const status = refundStatusFromPaystack(data?.status)
  const paystackId = data?.id != null ? String(data.id) : null
  let refund = paystackId ? await prisma.refund.findUnique({ where: { paystackRefundId: paystackId } }) : null
  if (!refund && typeof data?.transaction_reference === 'string') {
    // We don't know Paystack's id for it yet (e.g. the create call timed out). Match it only when that's unambiguous:
    // one open refund without an id on this payment, preferring the same amount.
    const payment = await prisma.payment.findUnique({ where: { providerRef: data.transaction_reference } })
    if (payment) {
      const open = await prisma.refund.findMany({
        where: { paymentId: payment.id, paystackRefundId: null, status: { in: ['PENDING', 'PROCESSING', 'NEEDS_ATTENTION'] } },
      })
      const pesewas = Number(data?.amount)
      const sameAmount = open.filter((r: { amount: number }) => Number.isFinite(pesewas) && Math.round(r.amount * 100) === pesewas)
      refund = sameAmount.length === 1 ? sameAmount[0] : open.length === 1 ? open[0] : null
      if (!refund && open.length > 1) {
        // Answer with an error so Paystack sends it again later, by when our side has saved Paystack's refund id.
        throw new Error(`refund event matches ${open.length} open refunds on ${data?.transaction_reference}`)
      }
    }
  }
  if (!refund || refund.status === 'PROCESSED' || refund.status === 'FAILED') return

  if (status === 'PROCESSED') {
    await markRefundProcessed(refund.id)
  } else {
    await prisma.refund.update({ where: { id: refund.id }, data: { status, paystackRefundId: refund.paystackRefundId ?? paystackId } })
    if (status === 'FAILED' || status === 'NEEDS_ATTENTION') {
      await notifyOps({
        title: status === 'FAILED' ? 'Refund failed' : 'Refund needs attention',
        body: `A refund of GHS ${refund.amount.toFixed(2)} ${status === 'FAILED' ? 'failed' : 'needs action in the Paystack dashboard'}. See the Exceptions page.`,
        url: '/ops/exceptions',
      })
    }
  }
}