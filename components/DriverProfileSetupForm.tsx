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

export default function DriverProfileSetupForm({ zones }: { zones: Zone[] }) {
  const [vehicleType, setVehicleType] = useState('Aboboyaa tricycle')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [address, setAddress] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [matchInfo, setMatchInfo] = useState('')
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function findZone() {
    if (!address.trim()) {
      setError('Enter your address first, or click directly on the map below')
      return
    }
    setError('')
    setMatchInfo('')
    setFinding(true)

    const res = await fetch('/api/driver/find-zone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    const data = await res.json()
    setFinding(false)

    if (!res.ok) {
      setError(data.error || 'Could not locate that address')
      return
    }

    setPin({ lat: data.lat, lng: data.lng })

    if (data.matchedZone) {
      setZoneId(data.matchedZone.id)
      setMatchInfo(`Matched to ${data.matchedZone.name}.`)
    } else if (data.nearestZone) {
      setMatchInfo(
        `No zone currently covers this location. Closest is ${data.nearestZone.name} (${data.nearestZone.distanceKm}km away) — you can select it manually below, or leave unassigned until a zone is added for your area.`
      )
    } else {
      setMatchInfo('No zones exist yet for your area. Leave the zone selection blank for now — an admin will assign one later.')
    }
  }

  function handleMapClick(newPin: { lat: number; lng: number }) {
    setPin(newPin)
    setMatchInfo('Custom location selected. Choose your zone manually from the dropdown below, if one fits.')
  }

  async function submit() {
    setError('')
    setLoading(true)

    const res = await fetch('/api/driver/profile-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleType,
        vehiclePlate,
        zoneId,
        homeAddress: address || null,
        homeLat: pin?.lat ?? null,
        homeLng: pin?.lng ?? null,
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not save your profile')
      return
    }

    router.push('/dashboard/driver')
    router.refresh()
  }

  return (
    <div>
      <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>Vehicle type</label>
      <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="input-field">
        <option value="Aboboyaa tricycle">Aboboyaa tricycle</option>
        <option value="Borla car">Borla car</option>
      </select>

      <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>
        Vehicle plate number (optional for now)
      </label>
      <input
        value={vehiclePlate}
        onChange={(e) => setVehiclePlate(e.target.value)}
        className="input-field"
        placeholder="e.g. GT 1234-24"
      />

      <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>
        Where do you operate from?
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input-field"
          placeholder="e.g. Tema Community 4, near the market"
          style={{ marginBottom: 0, flex: 1 }}
        />
        <button
          type="button"
          onClick={findZone}
          disabled={finding}
          className="btn-primary"
          style={{ whiteSpace: 'nowrap' }}
        >
          {finding ? 'Finding...' : 'Find My Zone'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        Or click directly on the map to pin your location manually.
      </p>
      <div style={{ marginBottom: 16 }}>
        <ZoneMap zones={zones} pin={pin} onPinChange={handleMapClick} />
      </div>

      {matchInfo && <p style={{ fontSize: 13, color: '#2F7A4D', marginBottom: 12 }}>{matchInfo}</p>}

      <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>
        Operating zone
      </label>
      <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="input-field">
        <option value="">No zone / unassigned</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>{z.name} — {z.city}</option>
        ))}
      </select>

      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <button onClick={submit} disabled={loading} className="btn-accent" style={{ width: '100%' }}>
        {loading ? 'Saving...' : 'Continue to Dashboard'}
      </button>
    </div>
  )
}