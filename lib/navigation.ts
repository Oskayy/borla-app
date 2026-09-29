// Links that open turn-by-turn directions in the driver's own navigation app. Pure functions, so they can be tested.

export interface LatLng {
  lat: number
  lng: number
}

function fmt(p: LatLng): string {
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
}

// Google Maps directions. With the phone's live position as the origin, the route starts exactly where the
// driver is (on a laptop Google would otherwise guess from the internet connection, which can be kilometres off).
// dir_action=navigate starts turn-by-turn straight away instead of showing a route preview.
export function googleDirectionsUrl(destination: LatLng, origin: LatLng | null): string {
  const params = new URLSearchParams({ api: '1', destination: fmt(destination), travelmode: 'driving', dir_action: 'navigate' })
  if (origin) params.set('origin', fmt(origin))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

// Waze always starts from the phone's own position.
export function wazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${fmt(destination)}&navigate=yes`
}

// Where a pickup's map position came from. Only pins placed by the customer are exact.
export type LocationSource = 'home_pin' | 'pin' | 'approximate'

export function pickupLocationSource(snapshot: unknown): LocationSource {
  const s = (snapshot as { locationSource?: unknown } | null)?.locationSource
  return s === 'home_pin' || s === 'pin' ? s : 'approximate'
}
