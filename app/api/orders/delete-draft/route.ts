import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { orderId } = await req.json()

  const order = await prisma.order.findUnique({ where: { id: orderId } })

  if (!order || order.customerId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only unpaid draft orders can be deleted' }, { status: 400 })
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