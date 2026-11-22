import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { parseReport, PROBLEMS, reportOptions, type ProblemKind } from '@/lib/customer-reports'
import { notifyOps } from '@/lib/notify'

// The customer says how a pickup went (lib/customer-reports.ts): "all good", a problem after collection (opens a
// dispute that holds the driver's pay for the order until ops deal with it), or an answer to a "gate locked" report.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'order_report', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "We couldn't find that pickup." }, { status: 400 })
  const parsed = parseReport(await readJson(req))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      customerId: true,
      status: true,
      quoteSnapshot: true,
      ledgerEntries: { where: { type: 'driver_payout_pickup' }, select: { createdAt: true }, take: 1 },
      disputes: { where: { status: 'OPEN', kind: 'CUSTOMER' }, select: { id: true }, take: 1 },
    },
  })
  if (!order || order.customerId !== auth.user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const can = reportOptions(order, order.ledgerEntries[0]?.createdAt ?? null, new Date(), order.disputes.length > 0)
  const address = (order.quoteSnapshot as { address?: string } | null)?.address ?? 'A pickup'

  if (parsed.kind === 'ALL_GOOD') {
    if (!can.problems) return NextResponse.json({ success: true })
    await prisma.auditLog.create({ data: { orderId: id, actorId: auth.user.id, fromState: order.status, toState: order.status, reason: 'CUSTOMER CONFIRMED: all good' } })
    return NextResponse.json({ success: true })
  }

  if (parsed.kind === 'GATE_REPLY' ? !can.gateReply : !can.problems) {
    return NextResponse.json({ error: order.disputes.length ? 'We already have your report and are looking into it.' : 'This pickup can no longer be reported here. Please contact Trashit support.' }, { status: 409 })
  }

  const what = parsed.kind === 'GATE_REPLY' ? 'Reply to "gate locked"' : PROBLEMS[parsed.kind as ProblemKind]
  const reason = `CUSTOMER ${parsed.kind === 'GATE_REPLY' ? 'REPLY' : 'REPORT'}: ${what}${parsed.note ? ` — ${parsed.note}` : ''}`
  await prisma.$transaction([
    prisma.dispute.create({ data: { orderId: id, raisedBy: auth.user.id, kind: 'CUSTOMER', reason: reason.slice(0, 600) } }),
    prisma.auditLog.create({ data: { orderId: id, actorId: auth.user.id, fromState: order.status, toState: order.status, reason: reason.slice(0, 600) } }),
  ])
  await notifyOps({
    title: parsed.kind === 'GATE_REPLY' ? 'Customer disputes a "gate locked" report' : 'Customer reported a problem',
    body: `${address}: ${what}${parsed.note ? ` — "${parsed.note.slice(0, 140)}"` : ''}. See the Exceptions page.`,
    url: '/ops/exceptions',
  })
  return NextResponse.json({ success: true })
}
