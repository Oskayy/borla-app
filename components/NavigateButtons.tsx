'use client'

import { Navigation } from 'lucide-react'
import { googleDirectionsUrl, wazeUrl } from '@/lib/navigation'
import { useLivePosition } from '@/lib/use-live-position'

// Opens turn-by-turn directions in the driver's own navigation app, starting from the phone's live position.
// `quiet`: outlined, for lists where another button (e.g. Confirm pickup) is the main action.
export default function NavigateButtons({ lat, lng, big = false, quiet = false }: { lat: number; lng: number; big?: boolean; quiet?: boolean }) {
  const { position } = useLivePosition()
  const origin = position ? { lat: position.lat, lng: position.lng } : null
  const google = googleDirectionsUrl({ lat, lng }, origin)
  const waze = wazeUrl({ lat, lng })
  const size = big ? 'min-h-14 text-base' : 'min-h-11 text-[15px]'

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <a
        href={google}
        target="_blank"
        rel="noopener noreferrer"
        className={`press inline-flex items-center justify-center gap-2 rounded-full px-5 font-semibold transition ${size} ${
          quiet ? 'text-action-deep ring-1 ring-action/50 hover:bg-action-wash' : 'bg-action text-on-action shadow-card hover:brightness-95'
        }`}
      >
        <Navigation aria-hidden className="size-5" /> Navigate with Google Maps
      </a>
      <a
        href={waze}
        target="_blank"
        rel="noopener noreferrer"
        className={`press inline-flex items-center justify-center rounded-full px-5 font-semibold text-ink ring-1 ring-line-strong transition hover:bg-canvas ${size}`}
      >
        Waze
      </a>
    </div>
  )
}
