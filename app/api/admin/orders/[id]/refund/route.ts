import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { REFUND_ROLES } from '@/lib/refunds'
import { refundOrder } from '@/lib/refunds-server'

// Staff refund all or part of an order's payment, optionally cancelling the order.
// Body: { amount: number | null (null = everything left), reason, cancel: boolean, paymentId?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(REFUND_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'staff_refund', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  const body = await readJson(req)
  const reason = cleanText(body?.reason, 200)
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Please give a reason' }, { status: 400 })
  const amount = body?.amount == null ? null : Number(body.amount)
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return NextResponse.json({ error: 'Please enter a valid amount' }, { status: 400 })
  }
  const paymentId = body?.paymentId == null ? undefined : body.paymentId
  if (paymentId !== undefined && !isUuid(paymentId)) return NextResponse.json({ error: 'Invalid payment' }, { status: 400 })

  const result = await refundOrder({ orderId: id, amount, reason, actorId: auth.user.id, cancel: body?.cancel === true, paymentId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  await logAdminAction(auth.user.id, 'REFUND_STARTED', id, `GHS ${result.refunded.toFixed(2)}${body?.cancel === true ? ' + cancelled' : ''}: ${reason}`)
  return NextResponse.json({ success: true, refunded: result.refunded })
}
