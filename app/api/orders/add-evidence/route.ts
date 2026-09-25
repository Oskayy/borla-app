import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { orderId, photoPath, type } = await req.json()

  if (!orderId || !photoPath) {
    return NextResponse.json({ error: 'Missing orderId or photoPath' }, { status: 400 })
  }

  await prisma.orderEvidence.create({
    data: {
      orderId,
      type: type || 'customer_placement',
      photoUrl: photoPath,
      capturedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}