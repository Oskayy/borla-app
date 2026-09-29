'use client'

import { useEffect, useState } from 'react'

// The phone's own GPS position, shared by every component on the page that needs it
// (the Navigate buttons, the next-stop card and the route map), so only one GPS watch runs.

export interface LivePosition {
  lat: number
  lng: number
  accuracyM: number
  at: number // when the phone reported it (ms)
}

// A fix is only trusted as a starting point if it is recent and reasonably precise.
export const MAX_FIX_AGE_MS = 2 * 60_000
export const MAX_FIX_ACCURACY_M = 150

let current: LivePosition | null = null
let watchId: number | null = null
let failed = false
const listeners = new Set<(p: LivePosition | null) => void>()

function start() {
  if (watchId !== null || typeof navigator === 'undefined' || !navigator.geolocation) return
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      failed = false
      current = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy, at: Date.now() }
      listeners.forEach((l) => l(current))
    },
    () => {
      failed = true
      listeners.forEach((l) => l(current))
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
  )
}

function stop() {
  if (watchId !== null && listeners.size === 0) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

export function isUsableFix(p: LivePosition | null, now = Date.now()): p is LivePosition {
  return !!p && now - p.at <= MAX_FIX_AGE_MS && p.accuracyM <= MAX_FIX_ACCURACY_M
}

// Returns the latest usable position (or null), and whether the phone refused to give one.
export function useLivePosition(enabled = true): { position: LivePosition | null; denied: boolean } {
  const [position, setPosition] = useState<LivePosition | null>(current)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const listener = (p: LivePosition | null) => {
      setPosition(p)
      setDenied(failed && !p)
    }
    listeners.add(listener)
    start()
    if (current) setPosition(current)
    return () => {
      listeners.delete(listener)
      stop()
    }
  }, [enabled])

  return { position: isUsableFix(position) ? position : null, denied }
}
