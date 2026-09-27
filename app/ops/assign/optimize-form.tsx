'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { distanceInMeters } from '@/lib/geo'

interface Zone {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
}

interface DriverProfile {
  vehicleType: string | null
  isActive: boolean
  zoneId: string | null
  zone: { id: string; name: string; city: string } | null
  currentLat: number | null
  currentLng: number | null
  homeLat: number | null
  homeLng: number | null
  lastLocationAt: string | null
}

interface Driver {
  id: string
  name: string
  driverProfile: DriverProfile | null
}

const LIVE_LOCATION_MAX_AGE_MINUTES = 15

// Finds which active zone (if any) a point falls inside, by nearest center within its radius.
function findZoneForPoint(lat: number, lng: number, zones: Zone[]): string | null {
  let best: { zoneId: string; distanceKm: number } | null = null

  for (const zone of zones) {
    if (zone.centerLat == null || zone.centerLng == null) continue
    const distanceKm = distanceInMeters(lat, lng, zone.centerLat, zone.centerLng) / 1000
    if (distanceKm <= zone.radiusKm && (!best || distanceKm < best.distanceKm)) {
      best = { zoneId: zone.id, distanceKm }
    }
  }

  return best?.zoneId ?? null
}

function driverLocation(profile: DriverProfile): { lat: number; lng: number; isLive: boolean } | null {
  if (profile.currentLat != null && profile.currentLng != null && profile.lastLocationAt) {
    const ageMinutes = (Date.now() - new Date(profile.lastLocationAt).getTime()) / 60000
    if (ageMinutes <= LIVE_LOCATION_MAX_AGE_MINUTES) {
      return { lat: profile.currentLat, lng: profile.currentLng, isLive: true }
    }
  }
  if (profile.homeLat != null && profile.homeLng != null) {
    return { lat: profile.homeLat, lng: profile.homeLng, isLive: false }
  }
  return null
}

export default function OptimizeForm({ orders, drivers, zones }: { orders: any[]; drivers: Driver[]; zones: Zone[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [driverId, setDriverId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function toggle(orderId: string) {
    setSelected((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    )
  }

  // Centroid (average point) of the selected orders that have coordinates —
  // used as the reference point for ranking drivers by distance.
  const centroid = useMemo(() => {
    const selectedOrders = orders.filter((o) => selected.includes(o.id) && o.latitude != null && o.longitude != null)
    if (selectedOrders.length === 0) return null

    const lat = selectedOrders.reduce((sum, o) => sum + o.latitude, 0) / selectedOrders.length
    const lng = selectedOrders.reduce((sum, o) => sum + o.longitude, 0) / selectedOrders.length
    return { lat, lng }
  }, [selected, orders])

  const matchedZoneId = useMemo(() => {
    if (!centroid) return null
    return findZoneForPoint(centroid.lat, centroid.lng, zones)
  }, [centroid, zones])

  const rankedDrivers = useMemo(() => {
    return drivers
      .map((driver) => {
        const profile = driver.driverProfile
        const loc = profile ? driverLocation(profile) : null
        const distanceKm = loc && centroid ? distanceInMeters(centroid.lat, centroid.lng, loc.lat, loc.lng) / 1000 : null
        const zoneMatch = !!matchedZoneId && profile?.zoneId === matchedZoneId

        return { driver, profile, distanceKm, zoneMatch, isLive: loc?.isLive ?? false }
      })
      .sort((a, b) => {
        if (a.zoneMatch !== b.zoneMatch) return a.zoneMatch ? -1 : 1
        if (a.distanceKm == null && b.distanceKm == null) return 0
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      })
  }, [drivers, centroid, matchedZoneId])

  async function optimizeAndAssign() {
    if (selected.length === 0 || !driverId) {
      setError('Select at least one order and a driver')
      return
    }
    setError('')
    setLoading(true)

    const selectedOrders = orders.filter((o) => selected.includes(o.id))
    const routable = selectedOrders.filter((o) => o.latitude != null && o.longitude != null).map((o) => o.id)
    const unroutable = selectedOrders.filter((o) => o.latitude == null || o.longitude == null).map((o) => o.id)

    try {
      if (routable.length > 0) {
        const res = await fetch('/api/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: routable, driverId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to optimize route')
        }
      }

      if (unroutable.length > 0) {
        const res = await fetch('/api/orders/manual-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: unroutable, driverId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to manually assign orders')
        }
      }

      setLoading(false)
      router.refresh()
    } catch (e: any) {
      setLoading(false)
      setError(e.message)
    }
  }

  return (
    <div>
      {orders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        const hasCoords = order.latitude != null && order.longitude != null
        return (
          <div key={order.id} className="panel" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={selected.includes(order.id)}
              onChange={() => toggle(order.id)}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 500 }}>{quote.address}</p>
              <p style={{ fontSize: 13, color: '#666' }}>
                GHS {quote.price} — {order.customer.name}
                {!hasCoords && (
                  <span style={{ color: '#E8A33D' }}> (no coordinates — will be manually assigned, not routed)</span>
                )}
              </p>
            </div>
          </div>
        )
      })}

      <div className="panel" style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Select a driver</p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          {selected.length === 0
            ? 'Select orders above to rank drivers by zone and distance.'
            : matchedZoneId
            ? 'Drivers in the matching zone, closest first, are listed at the top.'
            : 'No zone covers this location — drivers are ranked by distance only.'}
        </p>

        {drivers.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No active drivers found.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {rankedDrivers.map(({ driver, profile, distanceKm, zoneMatch, isLive }) => (
            <label
              key={driver.id}
              className="panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: 0,
                cursor: 'pointer',
                borderColor: driverId === driver.id ? 'var(--color-accent)' : undefined,
                borderWidth: driverId === driver.id ? 2 : undefined,
              }}
            >
              <input
                type="radio"
                name="driver"
                checked={driverId === driver.id}
                onChange={() => setDriverId(driver.id)}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500, marginBottom: 2 }}>
                  {driver.name}
                  {zoneMatch && (
                    <span style={{ fontSize: 11, color: '#2F7A4D', fontWeight: 600, marginLeft: 8 }}>
                      ✓ IN ZONE
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: '#666' }}>
                  {profile?.vehicleType || 'Vehicle not set'}
                  {profile?.zone && ` · Operates in ${profile.zone.name}`}
                  {distanceKm != null && ` · ${distanceKm.toFixed(1)}km away${isLive ? ' (live)' : ' (last known)'}`}
                  {distanceKm == null && ' · Distance unknown (no location on file)'}
                </p>
              </div>
            </label>
          ))}
        </div>

        {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button onClick={optimizeAndAssign} disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? 'Assigning...' : `Optimize & Assign (${selected.length} selected)`}
        </button>
      </div>
    </div>
  )
}