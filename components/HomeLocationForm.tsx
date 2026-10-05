'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Search } from 'lucide-react'
import PinPicker from './PinPicker'
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

interface Home {
  address: string
  lat: number | null
  lng: number | null
}

// `zones` is kept for the page that renders this form; the pin map doesn't draw them.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function HomeLocationForm({ zones, initial }: { zones: Zone[]; initial: Home | null }) {
  const [address, setAddress] = useState(initial?.address ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null
  )
  const [info, setInfo] = useState('')
  const [checked, setChecked] = useState(false)
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
      setChecked(false)
      setInfo(
        data.zoneName
          ? `That's the area (${data.zoneName}). Map searches are only roughly right: drag the pin onto your own house or gate.`
          : "That's the area, but we don't collect there yet. If it's wrong, drag the pin to the right spot."
      )
    } catch {
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setFinding(false)
    }
  }

  function handlePinChange(newPin: { lat: number; lng: number }) {
    setPin(newPin)
    setChecked(false)
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
    if (!checked) {
      setError('Please zoom in and confirm the pin is on your house or gate')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/customer/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, lat: pin.lat, lng: pin.lng, confirmed: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save your home location')
        return
      }
      router.push('/dashboard/customer/book')
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor="home-address" className="text-sm font-semibold text-ink">
          Home address, with a landmark
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="home-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`${FIELD} sm:flex-1`}
            placeholder="e.g. House 12, near Chemu SHS, Tema Community 4"
          />
          <button type="button" onClick={findOnMap} disabled={finding} className={BUTTON_QUIET}>
            <Search aria-hidden className="size-4" /> {finding ? 'Finding…' : 'Find on map'}
          </button>
        </div>
      </div>

      <p className="text-sm text-ink-2">
        Drivers go exactly to this pin at night, so put it on your house or gate. At home? Use your location. Otherwise zoom in until you
        see your roof and tap it.
      </p>
      <div className="overflow-hidden rounded-card ring-1 ring-line">
        <PinPicker pin={pin} onPinChange={handlePinChange} />
      </div>

      {pin && (
        <label className="flex cursor-pointer items-start gap-3 rounded-control bg-canvas p-3.5 text-[15px]">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 size-4 accent-customer" />
          <span>I zoomed in and the pin is on my house or gate</span>
        </label>
      )}

      {info && (
        <p role="status" className="text-sm text-customer-deep">
          {info}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <button onClick={save} disabled={saving} className={`w-full ${BUTTON_PRIMARY}`}>
        {saving ? 'Saving…' : 'Save my home pin'}
      </button>
    </div>
  )
}
