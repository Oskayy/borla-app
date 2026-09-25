import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Assigns orders to a driver in the exact order they were selected,
// without route optimization. Used for orders that have no coordinates
// (so Mapbox can't route them) but still need to reach a driver.
export async function POST(req: NextRequest) {
  const { orderIds, driverId } = await req.json()

  if (!orderIds || orderIds.length === 0 || !driverId) {
    return NextResponse.json({ error: 'orderIds and driverId are required' }, { status: 400 })
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, status: 'PAID' },
  })

  if (orders.length === 0) {
    return NextResponse.json({ error: 'No valid orders found' }, { status: 400 })
  }

  const route = await prisma.route.create({
    data: { driverId },
  })

  await prisma.$transaction([
    ...orders.map((order, index) =>
      prisma.routeStop.create({
        data: { routeId: route.id, orderId: order.id, sequence: index + 1 },
      })
    ),
    ...orders.map((order) =>
      prisma.order.update({
        where: { id: order.id },
        data: { driverId, status: 'ASSIGNED' },
      })
    ),
    ...orders.map((order) =>
      prisma.auditLog.create({
        data: {
          orderId: order.id,
          actorId: null,
          fromState: 'PAID',
          toState: 'ASSIGNED',
          reason: 'Manually assigned (no coordinates available for route optimization)',
        },
      })
    ),
  ])

  return NextResponse.json({ success: true, routeId: route.id, stopCount: orders.length })
}