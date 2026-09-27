'use client'

import { useEffect, useRef, useState } from 'react'

const UPDATE_INTERVAL_MS = 30_000 // send to server at most once every 30 seconds

export default function DriverLocationTracker() {
  const [status, setStatus] = useState<'idle' | 'tracking' | 'denied' | 'unsupported'>('idle')
  const lastSentAt = useRef<number>(0)
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setStatus('tracking')
        const now = Date.now()

        // Throttle: only actually send to the server every UPDATE_INTERVAL_MS,
        // even though the browser may report position changes more often.
        if (now - lastSentAt.current < UPDATE_INTERVAL_MS) return
        lastSentAt.current = now

        fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        }).catch(() => {
          // Silent fail — a missed location update isn't worth interrupting the driver over.
        })
      },
      () => {
        setStatus('denied')
      },
      { enableHighAccuracy: true, maximumAge: 15_000 }
    )

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [])

  if (status === 'denied') {
    return (
      <p style={{ fontSize: 12, color: '#E8A33D', marginBottom: 16 }}>
        Location access is off — turn it on in your browser settings so nearby jobs can be assigned to you efficiently.
      </p>
    )
  }

  if (status === 'unsupported') {
    return null
  }

  return (
    <p style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>
      {status === 'tracking' ? '📍 Location sharing is on' : 'Getting your location...'}
    </p>
  )
}