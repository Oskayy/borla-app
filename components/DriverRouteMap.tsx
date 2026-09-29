'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

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

// The driver's night on a map: home base, numbered stops in order, and the disposal sites, joined by a line.
export default function DriverRouteMap({ start, points }: { start: { lat: number; lng: number }; points: RoutePoint[] }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (map.current || !container.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const m = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [start.lng, start.lat],
      zoom: 12,
    })
    map.current = m

    m.on('load', () => {
      const line: [number, number][] = [[start.lng, start.lat], ...points.map((p) => [p.lng, p.lat] as [number, number])]
      m.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } },
      })
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#0F3D3E', 'line-width': 3, 'line-opacity': 0.6, 'line-dasharray': [2, 1] },
      })

      // Home base
      new mapboxgl.Marker({ color: '#666666' })
        .setLngLat([start.lng, start.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText('Your home base'))
        .addTo(m)

      for (const p of points) {
        const el = document.createElement('div')
        if (p.kind === 'stop') {
          el.textContent = p.label
          el.style.cssText = `width:26px;height:26px;border-radius:13px;background:${p.done ? '#9BB5B5' : '#E8A33D'};color:#1B2321;font:600 12px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)`
        } else {
          el.textContent = '🏁'
          el.style.cssText = 'font-size:22px;line-height:22px'
        }
        new mapboxgl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(p.kind === 'site' ? `<strong>${escapeHtml(p.label)}</strong><br/>Unload here` : `Stop ${escapeHtml(p.label)}`))
          .addTo(m)
      }

      const bounds = new mapboxgl.LngLatBounds()
      line.forEach((c) => bounds.extend(c))
      m.fitBounds(bounds, { padding: 40, maxZoom: 15 })
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
    // The page reloads when the route changes, so this only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={container} style={{ width: '100%', height: 280, borderRadius: 8 }} />
}
