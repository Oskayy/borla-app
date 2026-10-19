'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useLivePosition } from '@/lib/use-live-position'

export interface RoutePoint {
  kind: 'stop' | 'site'
  lat: number
  lng: number
  label: string
  done: boolean
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

// The driver's night on a map: where they are now (blue dot), numbered stops in order and the disposal sites.
// The line runs from the driver's live position through what is still to do. Before the phone has a GPS fix,
// it starts from the driver's home base instead.
export default function DriverRouteMap({
  start,
  points,
  live = true,
}: {
  start: { lat: number; lng: number } // home base, used until the phone reports its position
  points: RoutePoint[]
  live?: boolean // follow the phone's GPS (while online)
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const homeMarker = useRef<mapboxgl.Marker | null>(null)
  const meMarker = useRef<mapboxgl.Marker | null>(null)
  const fittedOnce = useRef(false)
  const fittedToLive = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const { position } = useLivePosition(live)

  const remaining = points.filter((p) => !p.done)

  useEffect(() => {
    if (map.current || !container.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    // Follows the app's light or dark mode (read once; the map is rebuilt when the page reloads).
    const dark = document.documentElement.dataset.theme === 'dark'
    const ink = dark ? '#7fc8a9' : '#1e5a45'
    const paper = dark ? '#0b1210' : '#ffffff'

    const m = new mapboxgl.Map({
      container: container.current,
      style: dark ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/streets-v12',
      center: [start.lng, start.lat],
      zoom: 12,
    })
    map.current = m

    m.on('load', () => {
      m.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': ink, 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [2, 1] },
      })

      for (const p of points) {
        const el = document.createElement('div')
        if (p.kind === 'stop') {
          el.textContent = p.label
          el.style.cssText = `width:28px;height:28px;border-radius:14px;background:${p.done ? '#9a9aa3' : ink};color:${paper};font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid ${paper};box-shadow:0 1px 4px rgba(0,0,0,.35)`
        } else {
          el.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
          el.style.cssText = `width:30px;height:30px;border-radius:15px;background:${p.done ? '#9a9aa3' : '#2b57a3'};display:flex;align-items:center;justify-content:center;border:2px solid ${paper};box-shadow:0 1px 4px rgba(0,0,0,.4)`
        }
        new mapboxgl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(p.kind === 'site' ? `<strong>${escapeHtml(p.label)}</strong><br/>Unload here` : `Stop ${escapeHtml(p.label)}`))
          .addTo(m)
      }
      setLoaded(true)
    })

    return () => {
      map.current?.remove()
      map.current = null
      homeMarker.current = null
      meMarker.current = null
    }
    // The page reloads when the route changes, so this only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw the line and "you are here" whenever the position changes.
  useEffect(() => {
    const m = map.current
    if (!m || !loaded) return
    const from = position ? { lat: position.lat, lng: position.lng } : start

    if (position) {
      homeMarker.current?.remove()
      homeMarker.current = null
      if (!meMarker.current) {
        const dot = document.createElement('div')
        dot.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#1A73E8;border:3px solid white;box-shadow:0 0 0 4px rgba(26,115,232,.25)'
        meMarker.current = new mapboxgl.Marker({ element: dot })
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText('You are here'))
          .setLngLat([position.lng, position.lat])
          .addTo(m)
      } else {
        meMarker.current.setLngLat([position.lng, position.lat])
      }
    } else if (!homeMarker.current && !meMarker.current) {
      homeMarker.current = new mapboxgl.Marker({ color: '#c98a4e' })
        .setLngLat([start.lng, start.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText('Your home base (waiting for your GPS)'))
        .addTo(m)
    }

    const line: [number, number][] = [[from.lng, from.lat], ...remaining.map((p) => [p.lng, p.lat] as [number, number])]
    const src = m.getSource('route') as mapboxgl.GeoJSONSource | undefined
    src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } })

    // Fit the view once at the start, and once more when the first live position arrives.
    if (!fittedOnce.current || (position && !fittedToLive.current)) {
      const bounds = new mapboxgl.LngLatBounds()
      line.slice(0, 4).forEach((c) => bounds.extend(c)) // where I am and the next few points
      m.fitBounds(bounds, { padding: 40, maxZoom: 15 })
      fittedOnce.current = true
      if (position) fittedToLive.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, loaded])

  return <div ref={container} style={{ width: '100%', height: 280 }} />
}
