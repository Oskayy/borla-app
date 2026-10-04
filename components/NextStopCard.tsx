'use client'

import NavigateButtons from '@/components/NavigateButtons'
import { AcceptAllButton, AcceptCountdown } from '@/components/StopResponse'
import { useLivePosition } from '@/lib/use-live-position'
import type { NextPoint } from '@/lib/driver-next'

// The one thing the driver should do next, at the top of the screen, with a single Navigate button.
export default function NextStopCard({
  next,
  online,
  waitingIds,
  firstDeadline,
  customerPhone,
}: {
  next: NextPoint
  online: boolean
  waitingIds: string[] // stops not accepted yet
  firstDeadline: string | null // the soonest accept deadline among them
  customerPhone: string | null // for the next stop, when its location is only approximate
}) {
  const { position, denied } = useLivePosition(online && !!next && (next.kind === 'stop' || next.kind === 'site'))

  const box = {
    marginBottom: 16,
    border: '2px solid var(--color-primary)',
    borderRadius: 8,
    padding: 14,
    background: '#F2F7F4',
  } as const
  const heading = { fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 } as const

  if (!next) return null

  if (next.kind === 'accept') {
    return (
      <div style={box}>
        <p style={heading}>NEW STOPS</p>
        <p style={{ fontSize: 14 }}>
          You have <strong>{next.count}</strong> new stop(s). Accept them to start, or decline any you can&apos;t do. A declined
          stop goes to another driver straight away.
        </p>
        {firstDeadline && <AcceptCountdown deadline={firstDeadline} />}
        <AcceptAllButton orderIds={waitingIds} />
      </div>
    )
  }

  if (!online) {
    return (
      <div style={{ ...box, borderColor: '#999', background: 'white' }}>
        <p style={{ fontSize: 14 }}>Go online to start your route. Directions to your first stop will appear here.</p>
      </div>
    )
  }

  const startNote = position
    ? `Directions start from where you are now (GPS within ${Math.round(position.accuracyM)} m).`
    : denied
    ? 'Location is blocked, so Google Maps will use its own guess of where you are. Turn location on for Trashit.'
    : 'Getting your GPS position...'

  if (next.kind === 'no-site') {
    return (
      <div style={{ ...box, borderColor: '#B3261E', background: '#FBEDEC' }}>
        <p style={heading}>TRIP {next.tripNumber}: UNLOAD</p>
        <p style={{ fontSize: 14 }}>No disposal site is set for this trip. Please call ops before unloading.</p>
      </div>
    )
  }

  if (next.kind === 'site') {
    return (
      <div style={box}>
        <p style={heading}>🏁 NEXT: UNLOAD (TRIP {next.tripNumber})</p>
        <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{next.name}</p>
        {next.lat != null && next.lng != null ? <NavigateButtons lat={next.lat} lng={next.lng} big /> : <p>No map position for this site. Call ops.</p>}
        <p style={{ fontSize: 11, color: '#666' }}>{startNote}</p>
      </div>
    )
  }

  return (
    <div style={box}>
      <p style={heading}>
        NEXT: STOP {next.stopNumber} (TRIP {next.tripNumber})
      </p>
      <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{next.address}</p>
      {next.approximate && (
        <p style={{ fontSize: 13, color: '#9A6415', background: '#FFF6E5', borderRadius: 4, padding: 8, marginBottom: 8 }}>
          ⚠ This customer didn&apos;t pin their gate, so the location is only approximate.
          {customerPhone && (
            <>
              {' '}
              <a href={`tel:${customerPhone}`}>Call the customer</a> when you get close.
            </>
          )}
        </p>
      )}
      {next.lat != null && next.lng != null ? (
        <NavigateButtons lat={next.lat} lng={next.lng} big />
      ) : (
        <p style={{ fontSize: 13, color: '#B3261E' }}>No map position for this stop. Call the customer or ops.</p>
      )}
      <p style={{ fontSize: 11, color: '#666' }}>{startNote}</p>
    </div>
  )
}
