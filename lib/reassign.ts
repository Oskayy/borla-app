// When a driver declines an order, these rules pick who gets it next and where it goes on their route.
// Pure functions (no database) so they can be tested.

import { distanceInMeters } from './geo'
import { assessDriver, driverPosition, nightCapacity, tripCapacity, type DispatchDriver, type DispatchOrder, type DriverFit } from './dispatch'
import { DEFAULT_UNLOAD_MINUTES, driveMinutes, STOP_MINUTES } from './trip-time'

// Rough extra minutes one more stop costs a driver: a detour there and back from where they are, plus collecting.
// An order that doesn't fit the open trip also costs a new trip and an unload.
function addedMinutes(d: DispatchDriver, order: DispatchOrder, shiftRunning: boolean, now: Date, newTrip: boolean): number {
  const p = driverPosition(d, shiftRunning, now)
  const detour = p && order.latitude != null && order.longitude != null ? 2 * driveMinutes(p, { lat: order.latitude, lng: order.longitude }) : 0
  return detour + STOP_MINUTES + (newTrip ? DEFAULT_UNLOAD_MINUTES : 0)
}

// Whether a driver still has a trip and the time for one more stop tonight.
export function hasRoomTonight(d: DispatchDriver, order: DispatchOrder, shiftRunning: boolean, now: Date): boolean {
  const perNight = Math.max(1, d.tripsPerNight ?? 1)
  const used = d.tripsUsed ?? 0
  // Litres on their open trip: what's on board that hasn't filled a whole trip yet.
  const openTrip = tripCapacity(d) > 0 ? d.loadLitres % tripCapacity(d) : 0
  const fitsOpenTrip = used > 0 && d.loadLitres > 0 && openTrip + order.litres <= tripCapacity(d)
  if (!fitsOpenTrip && used >= perNight) return false
  if (d.minutesLeft != null && addedMinutes(d, order, shiftRunning, now, !fitsOpenTrip) > d.minutesLeft) return false
  return true
}

export interface Replacement {
  driver: DispatchDriver | null
  fit: DriverFit | null
  reason: string // why nobody could take it (empty when a driver was found)
}

// The nearest eligible driver who hasn't declined this order. Ties go to the emptier vehicle.
export function pickReplacement(
  drivers: DispatchDriver[],
  order: DispatchOrder,
  declinedBy: string[],
  shiftRunning: boolean,
  now: Date
): Replacement {
  const blocked = new Set(declinedBy)
  const options = drivers
    .filter((d) => !blocked.has(d.id))
    .map((d) => ({ driver: d, fit: assessDriver(d, [order], shiftRunning, now) }))
    .filter((x) => x.fit.eligible && hasRoomTonight(x.driver, order, shiftRunning, now))

  if (options.length === 0) {
    const others = drivers.filter((d) => !blocked.has(d.id))
    const reason =
      others.length === 0
        ? 'No other drivers'
        : shiftRunning && others.every((d) => !assessDriver(d, [order], shiftRunning, now).counts)
        ? 'No other drivers online'
        : 'No other driver in range with room or time left'
    return { driver: null, fit: null, reason }
  }

  const score = (d: DispatchDriver) => {
    const p = driverPosition(d, shiftRunning, now)
    const km =
      p && order.latitude != null && order.longitude != null
        ? distanceInMeters(p.lat, p.lng, order.latitude, order.longitude) / 1000
        : 0
    return km + d.loadLitres / Math.max(1, nightCapacity(d)) / 100
  }
  options.sort((a, b) => score(a.driver) - score(b.driver))
  return { driver: options[0].driver, fit: options[0].fit, reason: '' }
}

export interface RouteTripLoad {
  tripNumber: number
  litresOnBoardOrPlanned: number // stops on this trip not yet unloaded
  finished: boolean // everything on this trip has been unloaded
}

// Where to put the new stop on the driver's existing route: on their last trip if it hasn't been unloaded
// and still has room, otherwise on a new trip.
export function placeOnRoute(
  trips: RouteTripLoad[],
  litres: number,
  driver: DispatchDriver
): { tripNumber: number; newTrip: boolean } {
  if (trips.length === 0) return { tripNumber: 1, newTrip: true }
  const last = [...trips].sort((a, b) => a.tripNumber - b.tripNumber)[trips.length - 1]
  if (!last.finished && last.litresOnBoardOrPlanned + litres <= tripCapacity(driver)) {
    return { tripNumber: last.tripNumber, newTrip: false }
  }
  return { tripNumber: last.tripNumber + 1, newTrip: true }
}
