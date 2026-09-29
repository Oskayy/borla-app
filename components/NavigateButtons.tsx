'use client'

import { googleDirectionsUrl, wazeUrl } from '@/lib/navigation'
import { useLivePosition } from '@/lib/use-live-position'

// Opens turn-by-turn directions in the driver's own navigation app, starting from the phone's live position.
export default function NavigateButtons({ lat, lng, big = false }: { lat: number; lng: number; big?: boolean }) {
  const { position } = useLivePosition()
  const origin = position ? { lat: position.lat, lng: position.lng } : null
  const google = googleDirectionsUrl({ lat, lng }, origin)
  const waze = wazeUrl({ lat, lng })
  const style = {
    display: 'inline-block',
    fontSize: big ? 16 : 13,
    padding: big ? '12px 18px' : '6px 12px',
    borderRadius: 4,
    textDecoration: 'none',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-primary)',
    background: 'white',
    textAlign: 'center',
  } as const

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <a
        href={google}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...style, background: 'var(--color-primary)', color: 'white', flex: big ? 1 : undefined }}
      >
        Navigate (Google Maps)
      </a>
      <a href={waze} target="_blank" rel="noopener noreferrer" style={style}>
        Waze
      </a>
    </div>
  )
}
