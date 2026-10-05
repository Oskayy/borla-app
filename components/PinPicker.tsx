'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { LocateFixed } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Pin {
  lat: number
  lng: number
}

const ACCRA: [number, number] = [-0.187, 5.6037]
const HOUSE_ZOOM = 18

// A map for putting a pin exactly on a house or gate. Satellite view so people can see their own roof,
// zoomed in close, with a pin they can drag, and a button to use the phone's GPS when they're at the spot.
export default function PinPicker({
  pin,
  onPinChange,
  height = 320,
}: {
  pin: Pin | null
  onPinChange: (pin: Pin, how: 'gps' | 'map') => void
  height?: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const onChange = useRef(onPinChange)
  useEffect(() => {
    onChange.current = onPinChange
  })
  const [locating, setLocating] = useState(false)
  const [gpsNote, setGpsNote] = useState('')

  useEffect(() => {
    if (map.current || !container.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    const m = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: pin ? [pin.lng, pin.lat] : ACCRA,
      zoom: pin ? HOUSE_ZOOM : 11,
    })
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('click', (e) => onChange.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }, 'map'))
    m.getCanvas().style.cursor = 'crosshair'
    map.current = m
    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the marker on the pin, and zoom in to it when it moves somewhere off screen or the map is zoomed out.
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!pin) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (!marker.current) {
      marker.current = new mapboxgl.Marker({ color: '#E8A33D', draggable: true }).setLngLat([pin.lng, pin.lat]).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current!.getLngLat()
        onChange.current({ lat: p.lat, lng: p.lng }, 'map')
      })
    } else {
      marker.current.setLngLat([pin.lng, pin.lat])
    }
    if (m.getZoom() < HOUSE_ZOOM - 2 || !m.getBounds()?.contains([pin.lng, pin.lat])) {
      m.flyTo({ center: [pin.lng, pin.lat], zoom: HOUSE_ZOOM })
    }
  }, [pin])

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGpsNote("This phone can't share its location. Tap your house on the map instead.")
      return
    }
    setLocating(true)
    setGpsNote('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const acc = Math.round(pos.coords.accuracy)
        onChange.current({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps')
        setGpsNote(
          acc <= 30
            ? `Location found (within about ${acc} m). Check the pin sits on your gate, and drag it if not.`
            : `Your phone's location is only accurate to about ${acc} m. Drag the pin onto your gate.`
        )
      },
      () => {
        setLocating(false)
        setGpsNote('Could not get your location. Allow location for Trashit, or tap your house on the map.')
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="flex min-h-11 w-full items-center justify-center gap-2 bg-canvas px-4 text-[15px] font-semibold text-ink transition hover:bg-line disabled:opacity-60"
      >
        <LocateFixed aria-hidden className="size-4 text-customer" />
        {locating ? 'Finding you…' : "I'm at the pickup spot: use my location"}
      </button>
      {gpsNote && (
        <p role="status" className="bg-canvas px-4 pb-2 text-sm text-ink-2">
          {gpsNote}
        </p>
      )}
      <div ref={container} style={{ width: '100%', height }} />
      <p className="bg-canvas px-4 py-2 text-xs text-ink-3">Tap the map or drag the pin. Zoom in until you can see your roof.</p>
    </div>
  )
}
