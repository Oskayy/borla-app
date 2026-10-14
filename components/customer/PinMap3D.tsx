'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// A small, tilted 3D map centred on the customer's saved pin: real streets and buildings (Mapbox Standard),
// with night lighting in dark mode. Look only: it doesn't move with the finger, so the page scrolls freely.
// Where Mapbox has no 3D buildings the streets stay flat; the pin is always exact.
export default function PinMap3D({ lat, lng, label, height = 190 }: { lat: number; lng: number; label: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!box.current || !token) {
      queueMicrotask(() => setFailed(true))
      return
    }
    mapboxgl.accessToken = token
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dark = () => document.documentElement.dataset.theme === 'dark'
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: box.current,
        style: 'mapbox://styles/mapbox/standard',
        config: { basemap: { lightPreset: dark() ? 'night' : 'day', showPointOfInterestLabels: false } },
        center: [lng, lat],
        zoom: 16.4,
        pitch: 58,
        bearing: -24,
        interactive: false,
        attributionControl: false,
      })
    } catch {
      queueMicrotask(() => setFailed(true))
      return
    }
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    // Keep the pin a little below the middle, clear of the place label at the top.
    map.setPadding({ top: 56, bottom: 0, left: 0, right: 0 })

    // The pin: a forest-green drop with a leaf-green centre that drops in once the map is ready.
    const el = document.createElement('div')
    el.className = 'pin3d'
    el.innerHTML = '<span class="pin3d-ring"></span><span class="pin3d-drop"></span>'
    new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map)

    map.on('load', () => {
      setReady(true)
      // A slow settle from a little higher up, unless motion is reduced.
      if (!still) map.easeTo({ zoom: 17, bearing: -16, duration: 1600, essential: false })
    })
    map.on('error', () => setFailed(true))

    // Follow the light/dark switch.
    const watch = new MutationObserver(() => {
      try {
        map.setConfigProperty('basemap', 'lightPreset', dark() ? 'night' : 'day')
      } catch {
        // style still loading: it picks up the theme on the next switch
      }
    })
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      watch.disconnect()
      map.remove()
    }
  }, [lat, lng])

  return (
    <div role="group" aria-label={label} className="relative overflow-hidden rounded-card bg-rail" style={{ height }}>
      <div ref={box} className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} />
      {!ready && !failed && <span aria-hidden className="skeleton absolute inset-0 rounded-none" />}
      {failed && (
        <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-ink-3">The map couldn&apos;t load. Your pin is saved.</span>
      )}
    </div>
  )
}
