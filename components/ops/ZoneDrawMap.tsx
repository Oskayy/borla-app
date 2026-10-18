'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import intersect from '@turf/intersect'
import { featureCollection, polygon as turfPolygon } from '@turf/helpers'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { storedBoundary, type ZoneBoundary } from '@/lib/zone-shape'

export interface OtherZone {
  id: string
  name: string
  active: boolean
  boundary: unknown
}

const RED = '#c4443a'

function overlapFeatures(shape: ZoneBoundary | null, others: OtherZone[]) {
  const out: GeoJSON.Feature[] = []
  if (!shape) return out
  for (const o of others) {
    const b = o.active ? storedBoundary(o.boundary) : null
    if (!b) continue
    const hit = intersect(featureCollection([turfPolygon(shape.coordinates), turfPolygon(b.coordinates)]))
    if (hit) out.push(hit)
  }
  return out
}

// A satellite map to draw a zone's outline: click to add corners, double-click (or click the first corner) to
// finish, drag a corner to move it, click a small dot between corners to add one. Other zones show for reference;
// where the outline overlaps one, it is painted red. `value` is the outline; `onChange` gets every edit.
export default function ZoneDrawMap({ value, others, onChange, startKey }: { value: ZoneBoundary | null; others: OtherZone[]; onChange: (b: ZoneBoundary | null) => void; startKey: string }) {
  const box = useRef<HTMLDivElement | null>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const draw = useRef<MapboxDraw | null>(null)
  const ready = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Build the map once per zone being edited (startKey changes when another zone is opened).
  useEffect(() => {
    if (!box.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    const shapes = others.map((o) => storedBoundary(o.boundary)).filter((b): b is ZoneBoundary => !!b)
    const all = [...(value ? [value] : []), ...shapes].flatMap((b) => b.coordinates[0])
    const m = new mapboxgl.Map({ container: box.current, style: 'mapbox://styles/mapbox/satellite-streets-v12', center: [-0.187, 5.6037], zoom: 11 })
    map.current = m
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    const d = new MapboxDraw({ displayControlsDefault: false, defaultMode: value ? 'simple_select' : 'draw_polygon' })
    draw.current = d
    m.addControl(d as unknown as mapboxgl.IControl)

    const emit = () => {
      const f = d.getAll().features.find((x) => x.geometry.type === 'Polygon') as GeoJSON.Feature<GeoJSON.Polygon> | undefined
      onChangeRef.current(f ? { type: 'Polygon', coordinates: [f.geometry.coordinates[0] as [number, number][]] } : null)
    }
    m.on('draw.create', () => {
      // One outline per zone: a new drawing replaces any older one.
      const fs = d.getAll().features
      if (fs.length > 1) d.delete(fs.slice(0, -1).map((f) => String(f.id)))
      emit()
    })
    m.on('draw.update', emit)
    m.on('draw.delete', emit)

    m.on('load', () => {
      ready.current = true
      m.addSource('others', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: others.flatMap((o) => {
            const b = storedBoundary(o.boundary)
            return b ? [{ type: 'Feature' as const, properties: { name: o.name, active: o.active }, geometry: b }] : []
          }),
        },
      })
      m.addLayer({ id: 'others-fill', type: 'fill', source: 'others', paint: { 'fill-color': ['case', ['get', 'active'], '#9cc9e4', '#8a94a3'], 'fill-opacity': 0.22 } })
      m.addLayer({ id: 'others-line', type: 'line', source: 'others', paint: { 'line-color': ['case', ['get', 'active'], '#9cc9e4', '#8a94a3'], 'line-width': 2 } })
      m.addLayer({ id: 'others-name', type: 'symbol', source: 'others', layout: { 'text-field': ['get', 'name'], 'text-size': 13 }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#10202b', 'text-halo-width': 1.5 } })
      m.addSource('overlap', { type: 'geojson', data: { type: 'FeatureCollection', features: overlapFeatures(value, others) } })
      m.addLayer({ id: 'overlap-fill', type: 'fill', source: 'overlap', paint: { 'fill-color': RED, 'fill-opacity': 0.5 } })
      if (value) d.add({ type: 'Feature', properties: {}, geometry: value })
      if (all.length) {
        const bounds = new mapboxgl.LngLatBounds()
        all.forEach((p) => bounds.extend(p))
        m.fitBounds(bounds, { padding: 50, duration: 0, maxZoom: 15 })
      }
    })
    return () => {
      ready.current = false
      m.remove()
      map.current = null
      draw.current = null
    }
    // Rebuilt only when another zone is opened; `value` and `others` updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey])

  // Keep the red overlap in step with the outline.
  useEffect(() => {
    const src = ready.current ? (map.current?.getSource('overlap') as mapboxgl.GeoJSONSource | undefined) : undefined
    src?.setData({ type: 'FeatureCollection', features: overlapFeatures(value, others) })
  }, [value, others])

  // When the outline is replaced from outside (Trim to fit, Start again), redraw it.
  useEffect(() => {
    const d = draw.current
    if (!d || !ready.current) return
    const current = d.getAll().features.find((x) => x.geometry.type === 'Polygon') as GeoJSON.Feature<GeoJSON.Polygon> | undefined
    const same = JSON.stringify(current?.geometry.coordinates ?? null) === JSON.stringify(value?.coordinates ?? null)
    if (same) return
    d.deleteAll()
    if (value) d.add({ type: 'Feature', properties: {}, geometry: value })
    else d.changeMode('draw_polygon')
  }, [value])

  return <div ref={box} role="application" aria-label="Map for drawing the zone's outline" className="h-[520px] w-full" />
}
