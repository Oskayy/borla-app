'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { areaKm2, storedBoundary } from '@/lib/zone-shape'

// Zone names and areas are typed by staff: escape them before they go into a map popup.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

interface ZoneData {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  coveredAreas: string[]
  active: boolean
  boundary?: unknown // the drawn outline; when set it is drawn instead of the circle
}

interface PreviewZone {
  centerLat: number
  centerLng: number
  radiusKm: number
  name: string
}

interface Pin {
  lat: number
  lng: number
}

function makeCircle(centerLat: number, centerLng: number, radiusKm: number, points = 64) {
  const coords: [number, number][] = []
  const distanceX = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180))
  const distanceY = radiusKm / 110.574

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    const x = distanceX * Math.cos(theta)
    const y = distanceY * Math.sin(theta)
    coords.push([centerLng + x, centerLat + y])
  }
  coords.push(coords[0])

  return coords
}

export default function ZoneMap({
  zones,
  preview,
  pin,
  onPinChange,
}: {
  zones: ZoneData[]
  preview?: PreviewZone | null
  pin?: Pin | null
  onPinChange?: (pin: Pin) => void
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const pinMarker = useRef<mapboxgl.Marker | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (map.current || !mapContainer.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const zonesWithCoords = zones.filter((z) => z.centerLat != null && z.centerLng != null)
    const initialCenter: [number, number] = preview
      ? [preview.centerLng, preview.centerLat]
      : pin
      ? [pin.lng, pin.lat]
      : zonesWithCoords.length > 0
      ? [zonesWithCoords[0].centerLng!, zonesWithCoords[0].centerLat!]
      : [-0.1870, 5.6037]

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialCenter,
      zoom: 11,
    })

    map.current.on('load', () => {
      loaded.current = true

      zonesWithCoords.forEach((zone) => {
        const outline = storedBoundary(zone.boundary)
        const circleCoords = outline ? outline.coordinates[0] : makeCircle(zone.centerLat!, zone.centerLng!, zone.radiusKm)

        map.current!.addSource(`zone-${zone.id}`, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circleCoords] } },
        })
        map.current!.addLayer({
          id: `zone-fill-${zone.id}`,
          type: 'fill',
          source: `zone-${zone.id}`,
          paint: { 'fill-color': zone.active ? '#3e6630' : '#8a94a3', 'fill-opacity': 0.15 },
        })
        map.current!.addLayer({
          id: `zone-outline-${zone.id}`,
          type: 'line',
          source: `zone-${zone.id}`,
          paint: { 'line-color': zone.active ? '#3e6630' : '#8a94a3', 'line-width': 2 },
        })

        const size = outline ? `${areaKm2(outline).toFixed(1)} km²` : `${zone.radiusKm} km radius`
        const popupHtml = `<strong>${esc(zone.name)}</strong><br/>${esc(zone.city)} · ${size}<br/>${zone.coveredAreas.length > 0 ? esc(zone.coveredAreas.join(', ')) : 'No towns listed'}`

        new mapboxgl.Marker({ color: '#3e6630' })
          .setLngLat([zone.centerLng!, zone.centerLat!])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml))
          .addTo(map.current!)
      })

      if (zonesWithCoords.length > 1 && !preview && !pin) {
        const bounds = new mapboxgl.LngLatBounds()
        zonesWithCoords.forEach((z) => bounds.extend([z.centerLng!, z.centerLat!]))
        map.current!.fitBounds(bounds, { padding: 60 })
      }

      addOrUpdatePreview()
      addOrUpdatePin()

      if (onPinChange) {
        map.current!.on('click', (e) => {
          onPinChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        })
        map.current!.getCanvas().style.cursor = 'crosshair'
      }
    })

    return () => {
      map.current?.remove()
      map.current = null
      loaded.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addOrUpdatePreview() {
    if (!map.current || !loaded.current) return

    if (map.current.getLayer('preview-fill')) map.current.removeLayer('preview-fill')
    if (map.current.getLayer('preview-outline')) map.current.removeLayer('preview-outline')
    if (map.current.getSource('preview')) map.current.removeSource('preview')

    if (!preview) return

    const circleCoords = makeCircle(preview.centerLat, preview.centerLng, preview.radiusKm)

    map.current.addSource('preview', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circleCoords] } },
    })
    map.current.addLayer({
      id: 'preview-fill',
      type: 'fill',
      source: 'preview',
      paint: { 'fill-color': '#2b57a3', 'fill-opacity': 0.25 },
    })
    map.current.addLayer({
      id: 'preview-outline',
      type: 'line',
      source: 'preview',
      paint: { 'line-color': '#2b57a3', 'line-width': 3, 'line-dasharray': [2, 1] },
    })

    map.current.flyTo({ center: [preview.centerLng, preview.centerLat], zoom: 12 })
  }

  function addOrUpdatePin() {
    if (!map.current || !loaded.current) return

    if (!pin) {
      pinMarker.current?.remove()
      pinMarker.current = null
      return
    }

    if (!pinMarker.current) {
      pinMarker.current = new mapboxgl.Marker({ color: '#c98a4e' }) // the driver's home base: clay
    }
    pinMarker.current.setLngLat([pin.lng, pin.lat]).addTo(map.current)
    map.current.flyTo({ center: [pin.lng, pin.lat], zoom: 13 })
  }

  useEffect(() => {
    addOrUpdatePreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.centerLat, preview?.centerLng, preview?.radiusKm])

  useEffect(() => {
    addOrUpdatePin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.lat, pin?.lng])

  return <div ref={mapContainer} style={{ width: '100%', height: '400px', borderRadius: 8 }} />
}