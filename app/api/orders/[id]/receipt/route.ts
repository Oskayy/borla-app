import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { customerStatus, type OrderSnapshot } from '@/lib/order-status'
import { dateLabel } from '@/lib/format'
import { buildReceiptPdf, receiptNumber } from '@/lib/receipt-pdf'

// The customer's PDF receipt for one of their paid orders.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'receipt', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "We couldn't find that pickup." }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      status: true,
      shiftDate: true,
      quoteSnapshot: true,
      customer: { select: { name: true } },
      payments: { where: { status: { in: ['success', 'partially_refunded', 'refunded'] } }, orderBy: { createdAt: 'asc' }, take: 1 },
      refunds: {
        where: { status: { in: ['PENDING', 'PROCESSING', 'PROCESSED', 'NEEDS_ATTENTION'] } },
        orderBy: { createdAt: 'asc' },
        select: { amount: true, status: true, createdAt: true },
      },
    },
  })
  if (!order || order.customerId !== auth.user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const payment = order.payments[0]
  if (!payment) return NextResponse.json({ error: 'This order has not been paid, so there is no receipt yet' }, { status: 409 })

  const q = (order.quoteSnapshot ?? {}) as OrderSnapshot & {
    recyclableDiscount?: number
    hazardSurcharge?: number
    lateSurcharge?: number
    taxLines?: { label: string; percent: number; amount: number }[]
    lines?: { litres?: number; label: string; count: number; lineTotal?: number }[]
  }

  const bytes = await buildReceiptPdf({
    orderId: order.id,
    customerName: order.customer.name,
    address: q.address ?? '',
    zoneName: q.zoneName ?? null,
    collectionNight: order.shiftDate ? dateLabel(order.shiftDate) : null,
    paidAt: payment.createdAt,
    paymentRef: payment.providerRef,
    lines: q.lines ?? [],
    recyclableDiscount: q.recyclableDiscount ?? 0,
    hazardSurcharge: q.hazardSurcharge ?? 0,
    lateSurcharge: q.lateSurcharge ?? 0,
    taxLines: q.taxLines ?? [],
    total: payment.amount,
    refunds: order.refunds,
    status: customerStatus(order.status).label,
  })

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="trashit-receipt-${receiptNumber(order.id)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
