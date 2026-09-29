import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

// A short fingerprint of the driver's current stops. When it changes (a stop added, taken away, collected...),
// the driver's screen reloads itself.
export async function driverRouteVersion(driverId: string): Promise<string> {
  const orders = await prisma.order.findMany({
    where: { driverId, status: { in: ['ASSIGNED', 'PICKED_UP', 'DISPOSAL_PENDING'] } },
    select: { id: true, status: true, driverAcceptedAt: true, routeStop: { select: { tripNumber: true, sequence: true } } },
    orderBy: { id: 'asc' },
  })
  const text = orders
    .map(
      (o: { id: string; status: string; driverAcceptedAt: Date | null; routeStop: { tripNumber: number; sequence: number } | null }) =>
        `${o.id}:${o.status}:${o.driverAcceptedAt ? 1 : 0}:${o.routeStop?.tripNumber ?? 0}:${o.routeStop?.sequence ?? 0}`
    )
    .join('|')
  return createHash('sha1').update(text).digest('hex').slice(0, 16)
}
