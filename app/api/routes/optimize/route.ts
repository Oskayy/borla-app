import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { orderIds, driverId } = await req.json()

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, status: 'PAID' },
  })

  if (orders.length === 0) {
    return NextResponse.json({ error: 'No valid orders found' }, { status: 400 })
  }

  const withCoords = orders.filter((o) => o.latitude != null && o.longitude != null)
  if (withCoords.length === 0) {
    return NextResponse.json({ error: 'None of the selected orders have coordinates' }, { status: 400 })
  }

  let orderedSequence = withCoords.map((o) => o.id) // fallback: original order

  if (withCoords.length > 1) {
    const coordsString = withCoords.map((o) => `${o.longitude},${o.latitude}`).join(';')

        const mapboxRes = await fetch(
      `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordsString}?roundtrip=false&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    )
    const mapboxData = await mapboxRes.json()

    if (mapboxData.trips && mapboxData.trips.length > 0) {
      // Mapbox returns each waypoint's position in the optimized order
      const waypointOrder = mapboxData.waypoints
        .map((wp: any, originalIndex: number) => ({ originalIndex, order: wp.waypoint_index }))
        .sort((a: any, b: any) => a.order - b.order)

      orderedSequence = waypointOrder.map((w: any) => withCoords[w.originalIndex].id)
    }
    // If Mapbox fails for any reason, we silently fall back to the original order above
    // rather than blocking assignment entirely — optimization is a convenience, not a requirement.
  }

  const route = await prisma.route.create({
    data: { driverId },
  })

  await prisma.$transaction([
    ...orderedSequence.map((orderId, index) =>
      prisma.routeStop.create({
        data: { routeId: route.id, orderId, sequence: index + 1 },
      })
    ),
    ...orderedSequence.map((orderId) =>
      prisma.order.update({
        where: { id: orderId },
        data: { driverId, status: 'ASSIGNED' },
      })
    ),
    ...orderedSequence.map((orderId) =>
      prisma.auditLog.create({
        data: {
          orderId,
          actorId: null,
          fromState: 'PAID',
          toState: 'ASSIGNED',
          reason: 'Assigned via route optimization',
        },
      })
    ),
  ])

  return NextResponse.json({ success: true, routeId: route.id, stopCount: orderedSequence.length })
}