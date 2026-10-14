'use client'

import Map3D from '@/components/kit/Map3D'

// The customer's saved pin on the shared 3D map.
export default function PinMap3D({ lat, lng, label, height = 190 }: { lat: number; lng: number; label: string; height?: number }) {
  return <Map3D markers={[{ lat, lng, kind: 'pin' }]} label={label} height={height} />
}
