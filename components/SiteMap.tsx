'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface MapZone {
  id: string
  name: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  active: boolean
}

export interface MapSite {
  id: string
  name: string
  lat: number | null
  lng: number | null
  geofenceRadiusM: number
  status: string
  active: boolean
  hoursLabel: string
}

interface Pin {
  lat: number
  lng: number
}

const STATUS_COLOURS: Record<string, string> = {
  OPEN: '#2F7A4D',
  FULL: '#E8A33D',
  CLOSED: '#B3261E',
}

function circle(lat: number, lng: number, radiusKm: number, points = 48): [number, number][] {
  const coords: [number, number][] = []
  const dx = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const dy = radiusKm / 110.574
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 2 * Math.PI
    coords.push([lng + dx * Math.cos(t), lat + dy * Math.sin(t)])
  }
  coords.push(coords[0])
  return coords
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

// Map of disposal sites (coloured by status, with their geofence circles) over the zones.
// When `editPin` is set, it shows that position with its geofence and lets ops click to move it.
export default function SiteMap({
  zones,
  sites,
  editPin,
  editRadiusM,
  onPinChange,
  onSiteClick,
  focusKey,
}: {
  zones: MapZone[]
  sites: MapSite[]
  editPin?: Pin | null
  editRadiusM?: number
  onPinChange?: (pin: Pin) => void
  onSiteClick?: (siteId: string) => void
  focusKey?: string | null // when this changes (e.g. a different site is opened), the map flies to the edit pin
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const loaded = useRef(false)
  const siteMarkers = useRef<mapboxgl.Marker[]>([])
  const editMarker = useRef<mapboxgl.Marker | null>(null)
  // Keep the latest callbacks without re-creating the map.
  const pinChangeRef = useRef(onPinChange)
  const siteClickRef = useRef(onSiteClick)
  pinChangeRef.current = onPinChange
  siteClickRef.current = onSiteClick

  useEffect(() => {
    if (map.current || !container.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const firstSite = sites.find((s) => s.lat != null && s.lng != null)
    const firstZone = zones.find((z) => z.centerLat != null && z.centerLng != null)
    const center: [number, number] = firstSite
      ? [firstSite.lng!, firstSite.lat!]
      : firstZone
      ? [firstZone.centerLng!, firstZone.centerLat!]
      : [-0.187, 5.6037] // Accra

    map.current = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom: 10,
    })

    map.current.on('load', () => {
      loaded.current = true
      const m = map.current!

      // Zones: faint, for context only.
      m.addSource('zones', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: zones
            .filter((z) => z.centerLat != null && z.centerLng != null)
            .map((z) => ({
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'Polygon' as const, coordinates: [circle(z.centerLat!, z.centerLng!, z.radiusKm)] },
            })),
        },
      })
      m.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': '#233a1e', 'fill-opacity': 0.06 } })
      m.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#233a1e', 'line-width': 1, 'line-opacity': 0.4 } })

      // Site geofences.
      m.addSource('geofences', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'geofences-fill',
        type: 'fill',
        source: 'geofences',
        paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.2 },
      })

      // The pin being edited.
      m.addSource('edit', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'edit-line',
        type: 'line',
        source: 'edit',
        paint: { 'line-color': '#E8A33D', 'line-width': 2, 'line-dasharray': [2, 1] },
      })

      m.on('click', (e) => {
        pinChangeRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })

      drawSites()
      drawEdit()
    })

    return () => {
      map.current?.remove()
      map.current = null
      loaded.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function drawSites() {
    const m = map.current
    if (!m || !loaded.current) return

    siteMarkers.current.forEach((mk) => mk.remove())
    siteMarkers.current = []

    const placed = sites.filter((s) => s.lat != null && s.lng != null)
    const source = m.getSource('geofences') as mapboxgl.GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features: placed.map((s) => ({
        type: 'Feature' as const,
        properties: { colour: s.active ? STATUS_COLOURS[s.status] ?? '#999999' : '#999999' },
        geometry: { type: 'Polygon' as const, coordinates: [circle(s.lat!, s.lng!, s.geofenceRadiusM / 1000)] },
      })),
    })

    placed.forEach((s) => {
      const colour = s.active ? STATUS_COLOURS[s.status] ?? '#999999' : '#999999'
      const marker = new mapboxgl.Marker({ color: colour })
        .setLngLat([s.lng!, s.lat!])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<strong>${escapeHtml(s.name)}</strong><br/>${escapeHtml(s.status)} · ${escapeHtml(s.hoursLabel)}`
          )
        )
        .addTo(m)
      marker.getElement().addEventListener('click', (ev) => {
        ev.stopPropagation() // don't also move the edit pin
        siteClickRef.current?.(s.id)
      })
      siteMarkers.current.push(marker)
    })
  }

  function drawEdit() {
    const m = map.current
    if (!m || !loaded.current) return
    const source = m.getSource('edit') as mapboxgl.GeoJSONSource | undefined

    if (!editPin) {
      editMarker.current?.remove()
      editMarker.current = null
      source?.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    if (!editMarker.current) editMarker.current = new mapboxgl.Marker({ color: '#233a1e' })
    editMarker.current.setLngLat([editPin.lng, editPin.lat]).addTo(m)
    source?.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'Polygon' as const, coordinates: [circle(editPin.lat, editPin.lng, (editRadiusM ?? 150) / 1000)] },
        },
      ],
    })
  }

  useEffect(() => {
    drawSites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sites)])

  useEffect(() => {
    drawEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPin?.lat, editPin?.lng, editRadiusM])

  // Fly to the edit pin when a different site is opened for editing (not on every click).
  useEffect(() => {
    if (focusKey && editPin && map.current) map.current.flyTo({ center: [editPin.lng, editPin.lat], zoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])

  return <div ref={container} style={{ width: '100%', height: 420, borderRadius: 8 }} />
}