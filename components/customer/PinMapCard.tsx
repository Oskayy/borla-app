'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import Skeleton from '@/components/kit/Skeleton'

// Loaded only when the home screen shows it, so the map library doesn't slow the first paint.
const PinMap3D = dynamic(() => import('@/components/customer/PinMap3D'), {
  ssr: false,
  loading: () => <Skeleton className="h-[190px] rounded-card" />,
})

// "Your pickup spot": the saved pin on a small 3D map, with a link to change it.
// `height`: 190 px on phones; the home page on a computer gives it more room.
export default function PinMapCard({ lat, lng, place, height = 190 }: { lat: number; lng: number; place: string; height?: number }) {
  return (
    <section aria-labelledby="spot-title" className="grid gap-2">
      <div className="flex items-center justify-between px-0.5">
        <h2 id="spot-title" className="text-sm font-semibold text-ink-3">
          Your pickup spot
        </h2>
        <Link href="/dashboard/customer/home-location" className="min-h-9 content-center text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
          Change
        </Link>
      </div>
      <div className="relative">
        <PinMap3D lat={lat} lng={lng} height={height} label={`3D map of your saved pickup pin${place ? `, ${place}` : ''}`} />
        {place && (
          <span className="absolute left-3 top-3 flex max-w-[75%] items-center gap-1.5 truncate rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-card">
            <MapPin aria-hidden className="size-3.5 shrink-0 text-action-deep" />
            <span className="truncate">{place}</span>
          </span>
        )}
      </div>
    </section>
  )
}
