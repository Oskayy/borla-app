// Works out where the driver should go next. Pure function, so it can be tested.
//
// Trips are worked in order. Within a trip: collect every stop, then unload at the trip's site.
// Stops the driver hasn't accepted yet must be accepted (or declined) before navigation starts.

export interface NextStopInput {
  id: string
  status: string // ASSIGNED = to collect, PICKED_UP = on board, anything else = done
  accepted: boolean
  address: string
  lat: number | null
  lng: number | null
  approximate: boolean
}

export interface NextTripInput {
  tripNumber: number
  orders: NextStopInput[]
  site: { name: string; lat: number | null; lng: number | null } | null
}

export type NextPoint =
  | { kind: 'accept'; count: number }
  | { kind: 'stop'; tripNumber: number; stopNumber: number; orderId: string; address: string; lat: number | null; lng: number | null; approximate: boolean }
  | { kind: 'site'; tripNumber: number; name: string; lat: number | null; lng: number | null }
  | { kind: 'no-site'; tripNumber: number }
  | null

export function nextPoint(trips: NextTripInput[]): NextPoint {
  const waiting = trips.flatMap((t) => t.orders).filter((o) => o.status === 'ASSIGNED' && !o.accepted).length
  if (waiting > 0) return { kind: 'accept', count: waiting }

  let stopNumber = 0
  for (const t of trips) {
    let firstToCollect: { order: NextStopInput; stopNumber: number } | null = null
    for (const o of t.orders) {
      stopNumber++
      if (!firstToCollect && o.status === 'ASSIGNED') firstToCollect = { order: o, stopNumber }
    }
    if (firstToCollect) {
      const o = firstToCollect.order
      return {
        kind: 'stop',
        tripNumber: t.tripNumber,
        stopNumber: firstToCollect.stopNumber,
        orderId: o.id,
        address: o.address,
        lat: o.lat,
        lng: o.lng,
        approximate: o.approximate,
      }
    }
    if (t.orders.some((o) => o.status === 'PICKED_UP')) {
      return t.site
        ? { kind: 'site', tripNumber: t.tripNumber, name: t.site.name, lat: t.site.lat, lng: t.site.lng }
        : { kind: 'no-site', tripNumber: t.tripNumber }
    }
  }
  return null
}
