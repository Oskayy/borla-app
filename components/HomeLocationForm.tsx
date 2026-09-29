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

interface Home {
  address: string
  lat: number | null
  lng: number | null
}

export default function HomeLocationForm({ zones, initial }: { zones: Zone[]; initial: Home | null }) {
  const [address, setAddress] = useState(initial?.address ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null
  )
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [finding, setFinding] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function findOnMap() {
    if (!address.trim()) {
      setError('Enter your address first, or tap your home on the map')
      return
    }
    setError('')
    setInfo('')
    setFinding(true)
    try {
      const res = await fetch('/api/customer/locate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not find that address')
        return
      }
      setPin({ lat: data.lat, lng: data.lng })
      setInfo(
        data.zoneName
          ? `Found it, in ${data.zoneName}. If the pin isn't exactly on your house, tap the right spot on the map.`
          : "Found it, but we don't collect in this area yet. If the pin is wrong, tap the right spot on the map."
      )
    } catch {
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setFinding(false)
    }
  }

  function handleMapClick(newPin: { lat: number; lng: number }) {
    setPin(newPin)
    setInfo('Pin moved. Save when it sits on your house or gate.')
  }

  async function save() {
    if (!address.trim()) {
      setError('Please enter your address, including a landmark drivers can find at night')
      return
    }
    if (!pin) {
      setError('Please place a pin on the map')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/customer/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, lat: pin.lat, lng: pin.lng }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save your home location')
        return
      }
      router.push('/dashboard/customer/book')
      router.refresh()
    } catch {
      setError('Could not reach Borla. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>
        Home address, with a landmark
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input-field"
          placeholder="e.g. House 12, near Chemu SHS, Tema Community 4"
          style={{ marginBottom: 0, flex: 1 }}
        />
        <button type="button" onClick={findOnMap} disabled={finding} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          {finding ? 'Finding...' : 'Find on map'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        Tap the map to put the pin exactly on your house or gate. Drivers use this pin at night.
      </p>
      <div style={{ marginBottom: 16 }}>
        <ZoneMap zones={zones} pin={pin} onPinChange={handleMapClick} />
      </div>

      {info && <p style={{ fontSize: 13, color: '#2F7A4D', marginBottom: 12 }}>{info}</p>}
      {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <button onClick={save} disabled={saving} className="btn-accent" style={{ width: '100%' }}>
        {saving ? 'Saving...' : 'Save my home location'}
      </button>
    </div>
  )
}