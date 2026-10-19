'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Marker icons, drawn in the app's icon style (Lucide's flag and house).
const SVG = (d: string) =>
  `<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
const ICON_FLAG = SVG('M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.33 2q2 0 3.67-.67V14q-1.67.67-3.67.67C12 14.67 10 13 8 13a6 6 0 0 0-4 1.33')
const ICON_HOUSE = SVG('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')

export interface MapMarker {
  lat: number
  lng: number
  kind: 'pin' | 'stop' | 'site' | 'home'
  label?: string // a stop's number, or a name for screen readers
  done?: boolean
}

// A small, tilted 3D map (Mapbox Standard: real streets and buildings, night lighting in dark mode).
// Look only: it doesn't move with the finger, so the page scrolls freely. One marker: centred on it;
// several: framed to show them all. Where Mapbox has no 3D buildings the streets stay flat.
// `flat`: an ordinary street map instead (streets by day, the night navigation style in dark mode) that can be
// dragged and zoomed (two fingers on a phone, so one finger still scrolls the page), framed on every marker.
export default function Map3D({
  markers,
  label,
  height = 190,
  flat = false,
  heightClass,
}: {
  markers: MapMarker[]
  label: string
  height?: number
  flat?: boolean
  heightClass?: string // responsive height (Tailwind classes) instead of the fixed `height`
}) {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const key = JSON.stringify(markers)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    const list: MapMarker[] = JSON.parse(key)
    if (!box.current || !token || list.length === 0) {
      queueMicrotask(() => setFailed(true))
      return
    }
    mapboxgl.accessToken = token
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dark = () => document.documentElement.dataset.theme === 'dark'
    const one = list.length === 1
    const flatStyle = () => (dark() ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/streets-v12')
    let map: mapboxgl.Map
    try {
      map = flat
        ? new mapboxgl.Map({
            container: box.current,
            style: flatStyle(),
            center: [list[0].lng, list[0].lat],
            zoom: one ? 15.5 : 13,
            cooperativeGestures: true,
            attributionControl: false,
          })
        : new mapboxgl.Map({
        container: box.current,
        style: 'mapbox://styles/mapbox/standard',
        config: { basemap: { lightPreset: dark() ? 'night' : 'day', showPointOfInterestLabels: false } },
        center: [list[0].lng, list[0].lat],
        zoom: one ? 16.4 : 13,
        pitch: 60,
        bearing: -24,
        interactive: false,
        attributionControl: false,
      })
    } catch {
      queueMicrotask(() => setFailed(true))
      return
    }
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    if (flat) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      if (!one) {
        const b = new mapboxgl.LngLatBounds()
        list.forEach((m) => b.extend([m.lng, m.lat]))
        map.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 })
      }
    } else if (one) map.setPadding({ top: 56, bottom: 0, left: 0, right: 0 })
    else {
      // Frame home and the stops (far-away sites may sit off the edge), close enough for the 3D buildings to show.
      const near = list.filter((m) => m.kind !== 'site')
      const b = new mapboxgl.LngLatBounds()
      ;(near.length ? near : list).forEach((m) => b.extend([m.lng, m.lat]))
      const cam = map.cameraForBounds(b, { padding: { top: 60, bottom: 30, left: 40, right: 40 }, pitch: 60, bearing: -24, maxZoom: 16.6 })
      map.jumpTo({ center: cam?.center ?? b.getCenter(), zoom: Math.max(15.1, cam?.zoom ?? 0), pitch: 60, bearing: -24 })
    }

    list.forEach((m, i) => {
      const el = document.createElement('div')
      el.style.setProperty('--i', String(i))
      if (m.kind === 'pin') {
        el.className = 'pin3d'
        el.innerHTML = '<span class="pin3d-ring"></span><span class="pin3d-drop"></span>'
      } else {
        el.className = `mark3d mark3d-${m.kind}${m.done ? ' is-done' : ''}`
        if (m.kind === 'stop') el.textContent = m.label ?? ''
        else el.innerHTML = m.kind === 'site' ? ICON_FLAG : ICON_HOUSE
        if (m.label) el.title = m.label
      }
      new mapboxgl.Marker({ element: el, anchor: m.kind === 'pin' ? 'bottom' : 'center' }).setLngLat([m.lng, m.lat]).addTo(map)
    })

    map.on('load', () => {
      setReady(true)
      if (flat) return
      if (!still && one) map.easeTo({ zoom: 17, bearing: -16, duration: 1600, essential: false })
      if (!still && !one) map.easeTo({ bearing: -12, duration: 1800, essential: false })
    })
    map.on('error', () => setFailed(true))

    const watch = new MutationObserver(() => {
      try {
        if (flat) map.setStyle(flatStyle())
        else map.setConfigProperty('basemap', 'lightPreset', dark() ? 'night' : 'day')
      } catch {
        // style still loading: it picks up the theme on the next switch
      }
    })
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      watch.disconnect()
      map.remove()
    }
  }, [key, flat])

  return (
    <div role="group" aria-label={label} className={`relative overflow-hidden rounded-card bg-rail ${heightClass ?? ''}`} style={heightClass ? undefined : { height }}>
      <div ref={box} className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} />
      {!ready && !failed && <span aria-hidden className="skeleton absolute inset-0 rounded-none" />}
      {failed && <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-ink-3">The map couldn&apos;t load.</span>}
    </div>
  )
}
