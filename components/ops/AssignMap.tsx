'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface MapRoute {
  driverId: string
  name: string
  initials: string
  start: { lat: number; lng: number } | null // live position, or home base
  points: { kind: 'stop' | 'site'; lat: number; lng: number; label: string }[] // in driving order
  problem: boolean
  planned?: boolean // a suggestion not yet approved (dashed); otherwise already given to the driver (solid)
}

// Colours follow the Legend Rule: driver amber, customer green, disposal site indigo; other routes recede to slate.
const AMBER = '#f0a43a'
const GREEN = '#12825a'
const INDIGO = '#4b40e0'
const SLATE = '#94a3b8'
const NIGHT = '#0e1726'

function esc(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

// Tonight's plan on a map: each driver's route from where they are, through their numbered pickups, to the
// disposal site that ends each trip. The selected driver's route is drawn in amber; the others recede.
export default function AssignMap({
  routes,
  unassigned,
  selected,
  onSelect,
}: {
  routes: MapRoute[]
  unassigned: { lat: number; lng: number; label: string }[]
  selected: string | null
  onSelect: (driverId: string | null) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (map.current || !box.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    const dark = document.documentElement.dataset.theme === 'dark'
    const m = new mapboxgl.Map({
      container: box.current,
      style: dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [-0.02, 5.67],
      zoom: 11,
      attributionControl: false,
    })
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new mapboxgl.AttributionControl({ compact: true }))
    m.on('load', () => {
      m.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['case', ['get', 'selected'], 8, 4], 'line-opacity': 0.9 },
      })
      m.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        filter: ['!', ['get', 'planned']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'selected'], AMBER, ['get', 'problem'], '#e5848f', SLATE],
          'line-width': ['case', ['get', 'selected'], 4.5, 2.5],
          'line-opacity': ['case', ['get', 'selected'], 1, 0.75],
        },
      })
      m.addLayer({
        id: 'routes-planned',
        type: 'line',
        source: 'routes',
        filter: ['get', 'planned'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'selected'], AMBER, ['get', 'problem'], '#e5848f', SLATE],
          'line-width': ['case', ['get', 'selected'], 4, 2.5],
          'line-dasharray': [1.5, 1.5],
        },
      })
      for (const layer of ['routes-line', 'routes-planned']) {
        m.on('click', layer, (e) => onSelect((e.features?.[0]?.properties?.driverId as string) ?? null))
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''))
      }
      setReady(true)
    })
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw lines and markers whenever the plan or the selection changes.
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const src = m.getSource('routes') as mapboxgl.GeoJSONSource | undefined
    src?.setData({
      type: 'FeatureCollection',
      features: routes.map((r) => ({
        type: 'Feature',
        properties: { driverId: r.driverId, selected: r.driverId === selected, problem: r.problem, planned: !!r.planned },
        geometry: {
          type: 'LineString',
          coordinates: [...(r.start ? [[r.start.lng, r.start.lat]] : []), ...r.points.map((p) => [p.lng, p.lat])],
        },
      })),
    })
    for (const layer of ['routes-casing', 'routes-line', 'routes-planned']) if (m.getLayer(layer)) m.moveLayer(layer) // above the map labels

    markers.current.forEach((mk) => mk.remove())
    markers.current = []
    const add = (el: HTMLElement, lng: number, lat: number, popup: string) =>
      markers.current.push(new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(popup)).addTo(m))

    // Selected route last, so its markers sit on top.
    const ordered = [...routes].sort((a, b) => Number(a.driverId === selected) - Number(b.driverId === selected))
    const startDrawn = new Set<string>() // a driver with a route and a suggestion gets one marker
    for (const r of ordered) {
      const on = r.driverId === selected
      const dim = selected != null && !on
      let stopNo = 0
      for (const p of r.points) {
        const el = document.createElement('div')
        if (p.kind === 'stop') {
          stopNo++
          el.textContent = String(stopNo)
          el.style.cssText = `width:${on ? 24 : 20}px;height:${on ? 24 : 20}px;border-radius:999px;background:${GREEN};color:#fff;font:700 ${on ? 11 : 10}px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);opacity:${dim ? 0.45 : 1}`
          add(el, p.lng, p.lat, `<strong>${esc(r.name)}</strong> · stop ${stopNo}<br/>${esc(p.label)}`)
        } else {
          el.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/></svg>'
          el.style.cssText = `width:26px;height:26px;border-radius:8px;background:${INDIGO};display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);opacity:${dim ? 0.55 : 1}`
          add(el, p.lng, p.lat, `<strong>${esc(p.label)}</strong><br/>Unload here`)
        }
      }
      if (r.start && !startDrawn.has(r.driverId)) {
        startDrawn.add(r.driverId)
        const el = document.createElement('button')
        el.type = 'button'
        el.textContent = r.initials
        el.setAttribute('aria-label', `${r.name}: show route`)
        el.style.cssText = `width:${on ? 34 : 28}px;height:${on ? 34 : 28}px;border-radius:999px;background:${on ? AMBER : NIGHT};color:${on ? NIGHT : '#fff'};font:700 11px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;opacity:${dim ? 0.6 : 1}`
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelect(r.driverId)
        })
        markers.current.push(new mapboxgl.Marker({ element: el }).setLngLat([r.start.lng, r.start.lat]).addTo(m))
      }
    }
    for (const u of unassigned) {
      const el = document.createElement('div')
      el.style.cssText = 'width:14px;height:14px;border-radius:999px;background:#fff;border:3px solid #94a3b8;box-shadow:0 1px 2px rgba(0,0,0,.3)'
      add(el, u.lng, u.lat, `<strong>Not assigned</strong><br/>${esc(u.label)}`)
    }

    // Frame the selected route, or everything.
    const pts: [number, number][] = []
    for (const r of routes) {
      if (selected && r.driverId !== selected) continue
      if (r.start) pts.push([r.start.lng, r.start.lat])
      r.points.forEach((p) => pts.push([p.lng, p.lat]))
    }
    if (!selected) unassigned.forEach((u) => pts.push([u.lng, u.lat]))
    if (pts.length === 1) m.easeTo({ center: pts[0], zoom: 14 })
    else if (pts.length > 1) {
      const b = pts.reduce((bb, p) => bb.extend(p), new mapboxgl.LngLatBounds(pts[0], pts[0]))
      m.fitBounds(b, { padding: 56, maxZoom: 15, duration: 600 })
    }
  }, [routes, unassigned, selected, ready, onSelect])

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-card ring-1 ring-line">
      {/* Inline position: mapbox-gl.css (unlayered) would otherwise override the Tailwind classes. */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/95 px-3 py-2 text-xs font-medium shadow-card ring-1 ring-line backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-driver" aria-hidden /> Driver
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-customer" aria-hidden /> Pickup
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ops" aria-hidden /> Disposal site
        </span>
        {routes.some((r) => r.planned) && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[#94a3b8]" aria-hidden /> Suggested
          </span>
        )}
        {unassigned.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-[#94a3b8] bg-white" aria-hidden /> Not assigned
          </span>
        )}
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="press absolute left-3 top-3 rounded-control bg-surface/95 px-3 py-2 text-xs font-semibold shadow-card ring-1 ring-line"
        >
          Show all routes
        </button>
      )}
    </div>
  )
}
