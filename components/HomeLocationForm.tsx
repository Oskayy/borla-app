'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import PinPicker from './PinPicker'
import PlaceSearch, { type PlaceHit } from './PlaceSearch'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'

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
  landmark: string
  lat: number | null
  lng: number | null
}

// `zones` is kept for the page that renders this form; the pin map doesn't draw them.
// `setup`: a new customer's first step after signing up; saving then opens their home page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function HomeLocationForm({ zones, initial, setup = false }: { zones: Zone[]; initial: Home | null; setup?: boolean }) {
  const [address, setAddress] = useState(initial?.address ?? '')
  const [landmark, setLandmark] = useState(initial?.landmark ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null
  )
  const [info, setInfo] = useState('')
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('') // problems that aren't about one field (e.g. no connection)
  // Each problem shows under the field it is about, and the page scrolls there.
  const [fieldError, setFieldError] = useState<{ field: Field; text: string } | null>(null)

  function problem(field: Field, text: string) {
    setError('')
    setFieldError({ field, text })
    const el = document.getElementById(`home-${field}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el instanceof HTMLInputElement) el.focus({ preventScroll: true })
  }
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // A place picked from the search: the map goes there; the person still puts the pin on their own gate.
  function placePicked(h: PlaceHit) {
    setError('')
    if (fieldError?.field === 'address') setFieldError(null)
    setPin({ lat: h.lat, lng: h.lng })
    setChecked(false)
    setInfo(`Found ${h.name}. Now zoom in and drag the pin onto your own house or gate.`)
  }

  function handlePinChange(newPin: { lat: number; lng: number }) {
    setPin(newPin)
    setChecked(false)
    setInfo('Pin moved. Save when it sits on your house or gate.')
  }

  async function save() {
    if (!address.trim()) {
      problem('address', 'Enter your area or street, e.g. Community 4, Tema')
      return
    }
    if (landmark.trim().length < 3) {
      problem('landmark', 'Add a landmark drivers can see at night, e.g. blue gate opposite the church')
      return
    }
    if (!pin) {
      problem('pin', 'Place a pin on your house or gate: use your location, or tap the map')
      return
    }
    if (!checked) {
      problem('checked', 'Zoom in, then tick this box once the pin is on your house or gate')
      return
    }
    setError('')
    setFieldError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/customer/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, landmark, lat: pin.lat, lng: pin.lng, confirmed: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save your home location')
        return
      }
      router.push(setup ? '/dashboard/customer' : '/dashboard/customer/book')
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
          Your area, street or a place near you
        </label>
        <div className="mt-1.5">
          <PlaceSearch
            id="home-address"
            value={address}
            onChange={(t) => {
              setAddress(t)
              if (fieldError?.field === 'address') setFieldError(null)
            }}
            onPick={placePicked}
            near={pin}
            invalid={fieldError?.field === 'address'}
            describedBy={fieldError?.field === 'address' ? 'home-address-error' : 'home-address-hint'}
            placeholder="e.g. Community 4 Tema, or Accra Mall"
          />
        </div>
        {fieldError?.field === 'address' ? (
          <FieldError id="home-address-error" text={fieldError.text} />
        ) : (
          <p id="home-address-hint" className="mt-1.5 text-sm text-ink-2">
            Pick a suggestion to move the map there, then put the pin on your own house or gate. At home? Use your location on the map.
          </p>
        )}
      </div>

      <div id="home-pin" className={`overflow-hidden rounded-card ring-1 ${fieldError?.field === 'pin' ? 'ring-2 ring-danger' : 'ring-line'}`}>
        <PinPicker
          pin={pin}
          onPinChange={(p) => {
            handlePinChange(p)
            if (fieldError?.field === 'pin') setFieldError(null)
          }}
        />
      </div>
      {fieldError?.field === 'pin' && <FieldError text={fieldError.text} />}

      {pin && (
        <label className={`flex cursor-pointer items-start gap-3 rounded-control bg-canvas p-3.5 text-[15px] ${fieldError?.field === 'checked' ? 'ring-2 ring-danger' : ''}`}>
          <input
            id="home-checked"
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked)
              if (fieldError?.field === 'checked') setFieldError(null)
            }} className="mt-1 size-4 accent-[var(--color-action-deep)]" />
          <span>I zoomed in and the pin is on my house or gate</span>
        </label>
      )}
      {pin && fieldError?.field === 'checked' && <FieldError text={fieldError.text} />}

      <div>
        <label htmlFor="home-landmark" className="text-sm font-semibold text-ink">
          Landmark drivers can see at night
        </label>
        <input
          id="home-landmark"
          value={landmark}
          maxLength={120}
          onChange={(e) => {
            setLandmark(e.target.value)
            if (fieldError?.field === 'landmark') setFieldError(null)
          }}
          aria-invalid={fieldError?.field === 'landmark' || undefined}
          aria-describedby={fieldError?.field === 'landmark' ? 'home-landmark-error' : 'home-landmark-hint'}
          className={`${FIELD} mt-1.5 ${fieldError?.field === 'landmark' ? 'border-danger ring-3 ring-danger/15' : ''}`}
          placeholder="e.g. Blue gate opposite Zenith Bank"
        />
        {fieldError?.field === 'landmark' ? (
          <FieldError id="home-landmark-error" text={fieldError.text} />
        ) : (
          <p id="home-landmark-hint" className="mt-1.5 text-sm text-ink-3">
            Shown to your driver with your area, e.g. a gate colour, a shop, a church or a sign.
          </p>
        )}
      </div>

      {info && (
        <p role="status" className="text-sm text-ok-deep">
          {info}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <button onClick={save} disabled={saving} className={`w-full ${BUTTON_PRIMARY}`}>
        {saving ? 'Saving…' : setup ? 'Save and continue' : 'Save my home pin'}
      </button>
    </div>
  )
}

type Field = 'address' | 'landmark' | 'pin' | 'checked'

function FieldError({ text, id }: { text: string; id?: string }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-2 text-sm font-medium text-danger">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {text}
    </p>
  )
}
