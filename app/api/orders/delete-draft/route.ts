import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isUuid, readJson } from '@/lib/validate'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  const orderId = (await readJson(req))?.orderId
  if (!isUuid(orderId)) return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id: orderId } })

  if (!order || order.customerId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only bookings that are not paid yet can be deleted.' }, { status: 400 })
  }

  // Delete evidence rows first (foreign key), then the order itself.
  // Note: this does not delete the uploaded photo file from Supabase Storage —
  // just the database records. Orphaned storage files are a minor cleanup
  // item, not a functional problem.
  await prisma.$transaction([
    prisma.orderEvidence.deleteMany({ where: { orderId } }),
    prisma.order.delete({ where: { id: orderId } }),
  ])

  return NextResponse.json({ success: true })
}