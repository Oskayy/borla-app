'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ZoneMap from './ZoneMap'

interface Zone {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  coveredAreas: string[]
  active: boolean
}

interface VehicleOption {
  id: string
  name: string
  capacityLitres: number
  defaultRadiusKm: number
  maxRadiusKm: number
  imagePath: string | null
}

interface ExistingProfile {
  vehicleTypeId: string | null
  vehiclePlate: string | null
  radiusKm: number | null
  zoneId: string | null
  homeAddress: string | null
  homeLat: number | null
  homeLng: number | null
}

export default function DriverProfileSetupForm({
  zones,
  vehicleTypes,
  initial,
}: {
  zones: Zone[]
  vehicleTypes: VehicleOption[]
  initial: ExistingProfile | null
}) {
  const startVehicle = vehicleTypes.find((v) => v.id === initial?.vehicleTypeId) ?? vehicleTypes[0] ?? null

  const [vehicleTypeId, setVehicleTypeId] = useState(startVehicle?.id ?? '')
  const [radiusKm, setRadiusKm] = useState(initial?.radiusKm ?? startVehicle?.defaultRadiusKm ?? 3)
  const [vehiclePlate, setVehiclePlate] = useState(initial?.vehiclePlate ?? '')
  const [address, setAddress] = useState(initial?.homeAddress ?? '')
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial?.homeLat != null && initial?.homeLng != null ? { lat: initial.homeLat, lng: initial.homeLng } : null
  )
  const [matchInfo, setMatchInfo] = useState('')
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const vehicle = vehicleTypes.find((v) => v.id === vehicleTypeId) ?? null
  const maxRadius = vehicle?.maxRadiusKm ?? 10

  function chooseVehicle(v: VehicleOption) {
    setVehicleTypeId(v.id)
    // Start from the new vehicle's default, never above its maximum.
    setRadiusKm(Math.min(v.defaultRadiusKm, v.maxRadiusKm))
  }

  async function findZone() {
    if (!address.trim()) {
      setError('Enter your address first, or click directly on the map below')
      return
    }
    setError('')
    setMatchInfo('')
    setFinding(true)

    try {
      const res = await fetch('/api/driver/find-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not locate that address')
        return
      }

      setPin({ lat: data.lat, lng: data.lng })

      if (data.matchedZone) {
        setZoneId(data.matchedZone.id)
        setMatchInfo(`Matched to ${data.matchedZone.name}. Tap the map if the pin isn't exactly where you start from.`)
      } else if (data.nearestZone) {
        setMatchInfo(
          `No zone covers this spot yet. The closest is ${data.nearestZone.name} (${data.nearestZone.distanceKm} km away). You can choose it below, or leave it unassigned.`
        )
      } else {
        setMatchInfo('No zones exist yet for your area. Leave the zone blank for now; an admin will assign one later.')
      }
    } catch {
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setFinding(false)
    }
  }

  function handleMapClick(newPin: { lat: number; lng: number }) {
    setPin(newPin)
    setMatchInfo('Home base moved. Choose your zone below if one fits.')
  }

  async function submit() {
    if (!vehicleTypeId) {
      setError('Please choose your vehicle')
      return
    }
    if (!pin) {
      setError('Please pin your home base on the map')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/driver/profile-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleTypeId,
          vehiclePlate,
          radiusKm,
          zoneId,
          homeAddress: address || null,
          homeLat: pin.lat,
          homeLng: pin.lng,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save your profile')
        return
      }
      router.push('/dashboard/driver')
      router.refresh()
    } catch {
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle = { fontSize: 13, color: '#666', display: 'block', marginBottom: 6 } as const

  return (
    <div>
      <label style={labelStyle}>Your vehicle</label>
      {vehicleTypes.length === 0 && (
        <p style={{ fontSize: 13, color: '#B3261E', marginBottom: 12 }}>No vehicles are set up yet. Please contact Borla support.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
        {vehicleTypes.map((v) => {
          const selected = v.id === vehicleTypeId
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => chooseVehicle(v)}
              aria-pressed={selected}
              style={{
                border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: selected ? '#F2F7F4' : 'white',
                borderRadius: 6,
                padding: 8,
                textAlign: 'center',
              }}
            >
              <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                {v.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.imagePath} alt="" style={{ maxHeight: 60, maxWidth: '100%' }} />
                ) : null}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</span>
            </button>
          )
        })}
      </div>

      <label style={labelStyle}>Vehicle plate number (optional for now)</label>
      <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className="input-field" placeholder="e.g. GT 1234-24" />

      <label style={labelStyle}>Your home base (where you start each night)</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input-field"
          placeholder="e.g. Tema Community 4, near the market"
          style={{ marginBottom: 0, flex: 1 }}
        />
        <button type="button" onClick={findZone} disabled={finding} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          {finding ? 'Finding...' : 'Find on map'}
        </button>
      </div>

      <label style={labelStyle}>
        How far will you travel for pickups? <strong style={{ color: 'var(--color-ink)' }}>{radiusKm} km</strong>
      </label>
      <input
        type="range"
        min={0.5}
        max={maxRadius}
        step={0.5}
        value={Math.min(radiusKm, maxRadius)}
        onChange={(e) => setRadiusKm(Number(e.target.value))}
        style={{ display: 'block', width: '100%', marginBottom: 4 }}
      />
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        Up to {maxRadius} km for {vehicle ? `a ${vehicle.name.toLowerCase()}` : 'this vehicle'}. The orange circle on the map shows
        your area. A smaller radius means shorter trips.
      </p>

      <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Tap the map to move your home base.</p>
      <div style={{ marginBottom: 16 }}>
        <ZoneMap
          zones={zones}
          pin={pin}
          onPinChange={handleMapClick}
          preview={pin ? { centerLat: pin.lat, centerLng: pin.lng, radiusKm, name: 'Your area' } : null}
        />
      </div>

      {matchInfo && <p style={{ fontSize: 13, color: '#2F7A4D', marginBottom: 12 }}>{matchInfo}</p>}

      <label style={labelStyle}>Operating zone</label>
      <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="input-field">
        <option value="">No zone / unassigned</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name} — {z.city}
          </option>
        ))}
      </select>

      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <button onClick={submit} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Saving...' : 'Save and continue'}
      </button>
    </div>
  )
}