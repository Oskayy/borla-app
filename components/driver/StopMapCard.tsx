'use client'

import dynamic from 'next/dynamic'
import Skeleton from '@/components/kit/Skeleton'

// The map loads only in the browser (Mapbox needs a window); a grey box holds its place meanwhile.
const StopMap = dynamic(() => import('@/components/driver/StopMap'), { ssr: false, loading: () => <Skeleton className="h-[clamp(240px,42vh,420px)] rounded-[16px]" /> })

// The stop page's map card: the pickup spot on a real street map, with where the driver is now.
export default function StopMapCard({ lat, lng, approximate, live }: { lat: number; lng: number; approximate: boolean; live: boolean }) {
  return (
    <section aria-labelledby="spot-title" className="grid gap-2 rounded-card bg-surface p-3.5 shadow-card ring-1 ring-line/70">
      <div className="flex items-center justify-between gap-3 px-1 pt-0.5">
        <h2 id="spot-title" className="truncate text-[15px] font-semibold">
          Pickup spot
        </h2>
        <span className="shrink-0 text-xs text-ink-3">{approximate ? 'Approximate' : 'Exact pin'}</span>
      </div>
      <StopMap lat={lat} lng={lng} approximate={approximate} live={live} />
    </section>
  )
}
