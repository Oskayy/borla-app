// Turns a typed Ghanaian address into coordinates using Mapbox. Returns null when not found.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    console.error('[geocode] NEXT_PUBLIC_MAPBOX_TOKEN is not set')
    return null
  }
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=GH&limit=1&access_token=${token}`,
      { signal: AbortSignal.timeout(6000) }
    )
    const data = await res.json()
    const center = data?.features?.[0]?.center
    if (Array.isArray(center) && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      return { lng: center[0], lat: center[1] }
    }
  } catch (e) {
    console.error('[geocode] failed:', e)
  }
  return null
}
