'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ZoneMap from './ZoneMap'
import { AlertCircle, Check, Search, Truck } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'

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
      setError('Could not reach Trashit. Please check your connection and try again.')
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
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const label = 'text-sm font-semibold text-ink'
  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className={label}>Your vehicle</legend>
        {vehicleTypes.length === 0 && <p className="mt-2 text-sm text-danger">No vehicles are set up yet. Please contact Trashit support.</p>}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {vehicleTypes.map((v) => {
            const selected = v.id === vehicleTypeId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => chooseVehicle(v)}
                aria-pressed={selected}
                className={`relative rounded-card p-3 text-center ring-1 transition ${
                  selected ? 'bg-action-wash ring-2 ring-action' : 'bg-surface ring-line hover:ring-line-strong'
                }`}
              >
                <span className="flex h-16 items-center justify-center">
                  {v.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.imagePath} alt="" className="max-h-14 max-w-full" />
                  ) : (
                    <Truck aria-hidden className="size-8 text-ink-3" />
                  )}
                </span>
                <span className="mt-1 block text-sm font-semibold">{v.name}</span>
                <span className="block text-xs text-ink-3 tabular-nums">{v.capacityLitres.toLocaleString()} L</span>
                {selected && <Check aria-hidden className="absolute right-2.5 top-2.5 size-4 text-action" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="plate" className={label}>
          Vehicle plate number <span className="font-normal text-ink-3">(optional for now)</span>
        </label>
        <input id="plate" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. GT 1234-24" />
      </div>

      <div>
        <label htmlFor="home-base" className={label}>
          Your home base <span className="font-normal text-ink-3">(where you start each night)</span>
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="home-base"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`${FIELD} sm:flex-1`}
            placeholder="e.g. Tema Community 4, near the market"
          />
          <button type="button" onClick={findZone} disabled={finding} className={BUTTON_QUIET}>
            <Search aria-hidden className="size-4" /> {finding ? 'Finding…' : 'Find on map'}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="radius" className={`${label} flex items-baseline justify-between gap-3`}>
          How far will you travel for pickups? <span className="text-lg font-bold tabular-nums text-action">{radiusKm} km</span>
        </label>
        <input
          id="radius"
          type="range"
          min={0.5}
          max={maxRadius}
          step={0.5}
          value={Math.min(radiusKm, maxRadius)}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="mt-2 block h-11 w-full accent-[var(--color-action)]"
        />
        <p className="text-sm text-ink-3">
          Up to {maxRadius} km for {vehicle ? `${/^[aeiou]/i.test(vehicle.name) ? 'an' : 'a'} ${vehicle.name.toLowerCase()}` : 'this vehicle'}. The circle on the map shows your area; a
          smaller radius means shorter trips.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm text-ink-2">Tap the map to move your home base.</p>
        <div className="overflow-hidden rounded-card ring-1 ring-line">
          <ZoneMap
            zones={zones}
            pin={pin}
            onPinChange={handleMapClick}
            preview={pin ? { centerLat: pin.lat, centerLng: pin.lng, radiusKm, name: 'Your area' } : null}
          />
        </div>
        {matchInfo && (
          <p role="status" className="mt-2 text-sm text-customer-deep">
            {matchInfo}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="zone" className={label}>
          Operating zone
        </label>
        <select id="zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={`${FIELD} mt-1.5`}>
          <option value="">No zone / unassigned</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} — {z.city}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <button onClick={submit} disabled={loading} className={`w-full min-h-12 ${BUTTON_PRIMARY}`}>
        {loading ? 'Saving…' : 'Save and continue'}
      </button>
    </div>
  )
}
