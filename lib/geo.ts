// lib/geo.ts
// Calculates the distance in meters between two GPS coordinates
// using the Haversine formula.
export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// How far off (in meters) we'll accept before flagging a mismatch.
// Ghanaian GPS/geocoding accuracy is imprecise, so this is intentionally generous.
export const GEOFENCE_THRESHOLD_METERS = 150;