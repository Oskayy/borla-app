import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { getShiftSettings } from '@/lib/settings'
import { customerCancelCheck } from '@/lib/refunds'
import { refundOrder } from '@/lib/refunds-server'

// A customer cancels a paid order before its collection night starts, and gets a full refund.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'cancel_order', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  const reason = cleanText(body?.reason, 200) || 'No reason given'
  if (!isUuid(orderId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, status: true, shiftDate: true } })
  if (!order || order.customerId !== auth.user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const check = customerCancelCheck(order, new Date(), await getShiftSettings())
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 })

  const result = await refundOrder({ orderId, amount: null, reason: `Cancelled by customer: ${reason}`, actorId: auth.user.id, cancel: true })
  if (!result.ok) {
    console.error('[cancel] refund failed', orderId, result.error)
    return NextResponse.json({ error: 'We could not start your refund right now. Please try again, or contact Borla support.' }, { status: 502 })
  }
  return NextResponse.json({ success: true, refunded: result.refunded })
}
