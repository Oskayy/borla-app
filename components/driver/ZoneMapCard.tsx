'use client'

import dynamic from 'next/dynamic'
import Skeleton from '@/components/kit/Skeleton'
import type { MapMarker } from '@/components/kit/Map3D'

// Loaded only when shown, so the map library doesn't slow the first paint.
const Map3D = dynamic(() => import('@/components/kit/Map3D'), { ssr: false, loading: () => <Skeleton className="h-[220px] rounded-card" /> })

// The driver's area on the 3D map: tonight's stops (numbered), where to unload (flag) and home base.
export default function ZoneMapCard({
  markers,
  title,
  radius,
  stops,
  legend = true,
}: {
  markers: MapMarker[]
  title: string
  radius: string | null
  stops: number
  legend?: boolean
}) {
  return (
    <section aria-labelledby="zone-title" className="grid gap-2 rounded-card bg-surface p-3.5 shadow-card ring-1 ring-line/70">
      <div className="flex items-center justify-between gap-3 px-1 pt-0.5">
        <h2 id="zone-title" className="truncate text-[15px] font-semibold">
          {title}
        </h2>
        {radius && <span className="shrink-0 text-xs text-ink-3">{radius}</span>}
      </div>
      <Map3D
        flat
        markers={markers}
        heightClass="h-[260px] lg:h-[clamp(380px,62vh,560px)]"
        label={`Map of your area${stops ? ` with tonight's ${stops} ${stops === 1 ? 'stop' : 'stops'}` : ''}, where to unload and your home base`}
      />
      {legend && (
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-[#1e5a45]" /> Stops
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-[#2b57a3]" /> Where to unload
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-[#c98a4e]" /> Home base
        </span>
      </p>
      )}
    </section>
  )
}
