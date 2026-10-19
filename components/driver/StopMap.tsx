'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useLivePosition } from '@/lib/use-live-position'

// One stop on a real street map: the customer's pin, and where the driver is now (blue dot) once the phone has a
// position. Drag and pinch like any map; it frames both at first, then leaves the view to the driver. Streets in
// light mode, the night navigation style in dark mode.
export default function StopMap({ lat, lng, approximate, live = true }: { lat: number; lng: number; approximate: boolean; live?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const me = useRef<mapboxgl.Marker | null>(null)
  const framedLive = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const { position } = useLivePosition(live)

  useEffect(() => {
    if (map.current || !box.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    const dark = document.documentElement.dataset.theme === 'dark'
    const m = new mapboxgl.Map({
      container: box.current,
      style: dark ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 15.5,
      cooperativeGestures: true, // one finger scrolls the page; two fingers move the map
      attributionControl: false,
    })
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new mapboxgl.AttributionControl({ compact: true }))
    const pin = document.createElement('div')
    pin.setAttribute('aria-hidden', 'true')
    pin.style.cssText =
      'width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1e5a45;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)'
    new mapboxgl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(m)
    m.on('load', () => {
      if (approximate) {
        // An approximate spot: a soft circle of about 150 m instead of a pretend-exact point.
        m.addSource('area', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } } })
        m.addLayer({
          id: 'area',
          type: 'circle',
          source: 'area',
          paint: {
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 12, 6, 20, 1500],
            'circle-color': '#d9a06b',
            'circle-opacity': 0.25,
            'circle-stroke-color': '#d9a06b',
            'circle-stroke-width': 2,
          },
        })
      }
      setLoaded(true)
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(box.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      me.current = null
    }
  }, [lat, lng, approximate])

  // The driver's position: move the dot, and frame pin and driver together once when the first fix arrives.
  useEffect(() => {
    const m = map.current
    if (!m || !loaded || !position) return
    if (!me.current) {
      const dot = document.createElement('div')
      dot.setAttribute('aria-hidden', 'true')
      dot.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#1A73E8;border:3px solid white;box-shadow:0 0 0 4px rgba(26,115,232,.25)'
      me.current = new mapboxgl.Marker({ element: dot }).setLngLat([position.lng, position.lat]).addTo(m)
    } else me.current.setLngLat([position.lng, position.lat])
    if (!framedLive.current) {
      framedLive.current = true
      const b = new mapboxgl.LngLatBounds([lng, lat], [lng, lat]).extend([position.lng, position.lat])
      m.fitBounds(b, { padding: 60, maxZoom: 16, duration: 0 })
    }
  }, [position, loaded, lat, lng])

  return (
    <div className="relative h-[clamp(240px,42vh,420px)] overflow-hidden rounded-[16px] ring-1 ring-line">
      <div ref={box} role="img" aria-label={`Map of the pickup spot${approximate ? ' (approximate)' : ''}${position ? ' and where you are' : ''}`} style={{ position: 'absolute', inset: 0 }} />
      <p className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-x-3 gap-y-1 rounded-control bg-surface/95 px-2.5 py-1.5 text-xs font-medium shadow-card ring-1 ring-line">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-[#1e5a45]" /> Pickup
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-[#1A73E8]" /> You
        </span>
      </p>
    </div>
  )
}
