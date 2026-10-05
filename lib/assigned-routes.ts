// Routes already given to drivers (not yet unloaded), for the Plan & assign map.
// Each driver's stops in driving order (route, then trip, then stop sequence), with each trip's disposal site after it.

import { prisma } from '@/lib/prisma'
import { driverPosition, type DispatchDriver } from '@/lib/dispatch'
import type { MapRoute } from '@/components/ops/AssignMap'

const ON_ROUTE = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP'] as const

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

export async function loadAssignedRoutes(drivers: DispatchDriver[], shiftRunning: boolean, now: Date): Promise<MapRoute[]> {
  const orders = await prisma.order.findMany({
    where: { driverId: { not: null }, status: { in: [...ON_ROUTE] } },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      quoteSnapshot: true,
      driverId: true,
      driver: { select: { name: true } },
      routeStop: {
        select: {
          sequence: true,
          tripNumber: true,
          route: { select: { id: true, createdAt: true, trips: { select: { tripNumber: true, facility: { select: { name: true, lat: true, lng: true } } } } } },
        },
      },
    },
  })

  const byDriver = new Map<string, typeof orders>()
  for (const o of orders) byDriver.set(o.driverId!, [...(byDriver.get(o.driverId!) ?? []), o])

  const routes: MapRoute[] = []
  for (const [driverId, list] of byDriver) {
    const sorted = [...list].sort((a, b) => {
      const ra = a.routeStop?.route.createdAt.getTime() ?? 0
      const rb = b.routeStop?.route.createdAt.getTime() ?? 0
      return ra - rb || (a.routeStop?.tripNumber ?? 0) - (b.routeStop?.tripNumber ?? 0) || (a.routeStop?.sequence ?? 0) - (b.routeStop?.sequence ?? 0)
    })
    const points: MapRoute['points'] = []
    let current = ''
    let pendingSite: MapRoute['points'][number] | null = null
    for (const o of sorted) {
      const key = o.routeStop ? `${o.routeStop.route.id}-${o.routeStop.tripNumber}` : `order-${o.id}`
      if (key !== current) {
        if (pendingSite) points.push(pendingSite)
        current = key
        const site = o.routeStop?.route.trips.find((t) => t.tripNumber === o.routeStop!.tripNumber)?.facility
        pendingSite = site?.lat != null && site.lng != null ? { kind: 'site', lat: site.lat, lng: site.lng, label: site.name } : null
      }
      if (o.latitude != null && o.longitude != null) {
        points.push({ kind: 'stop', lat: o.latitude, lng: o.longitude, label: (o.quoteSnapshot as { address?: string } | null)?.address ?? 'Stop' })
      }
    }
    if (pendingSite) points.push(pendingSite)

    const d = drivers.find((x) => x.id === driverId)
    const pos = d ? driverPosition(d, shiftRunning, now) : null
    const name = sorted[0]?.driver?.name ?? 'Driver'
    routes.push({ driverId, name, initials: initialsOf(name), start: pos ? { lat: pos.lat, lng: pos.lng } : null, points, problem: false, planned: false })
  }
  return routes
}
