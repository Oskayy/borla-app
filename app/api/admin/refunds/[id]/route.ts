import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { REFUND_ROLES } from '@/lib/refunds'
import { markRefundProcessed } from '@/lib/refunds-server'

// Settles a refund Paystack never answered about ("needs attention"), after checking the Paystack dashboard:
//   processed -> Paystack shows the refund was made
//   failed    -> Paystack has no such refund; the amount is released so it can be refunded again
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(REFUND_ROLES)
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid refund' }, { status: 400 })
  const body = await readJson(req)
  const outcome = body?.outcome
  const note = cleanText(body?.note, 200)
  if (outcome !== 'processed' && outcome !== 'failed') return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
  if (!note || note.length < 3) return NextResponse.json({ error: 'Please note what you saw in Paystack' }, { status: 400 })

  const refund = await prisma.refund.findUnique({ where: { id } })
  if (!refund) return NextResponse.json({ error: 'Refund not found' }, { status: 404 })
  if (!['NEEDS_ATTENTION', 'PENDING', 'PROCESSING'].includes(refund.status)) {
    return NextResponse.json({ error: `This refund is already ${refund.status.toLowerCase()}` }, { status: 409 })
  }

  if (outcome === 'processed') {
    await markRefundProcessed(id)
  } else {
    const moved = await prisma.refund.updateMany({
      where: { id, status: refund.status },
      data: { status: 'FAILED', reason: `${refund.reason} [closed by staff: ${note}]` },
    })
    if (moved.count !== 1) return NextResponse.json({ error: 'This refund was just updated. Please refresh.' }, { status: 409 })
  }
  await prisma.auditLog.create({
    data: { orderId: refund.orderId, actorId: auth.user.id, fromState: refund.status, toState: outcome === 'processed' ? 'PROCESSED' : 'FAILED', reason: `REFUND SETTLED BY STAFF: ${note}` },
  })
  await logAdminAction(auth.user.id, 'REFUND_SETTLED', id, `${outcome}: ${note}`)
  return NextResponse.json({ success: true })
}
