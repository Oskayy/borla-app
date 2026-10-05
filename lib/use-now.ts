'use client'

import { useCallback, useSyncExternalStore } from 'react'

// The current time, ticking every `stepMs`, for live countdowns.
// Returns null during the server render and hydration (the server's clock and the browser's differ, which would
// make React rebuild the page), then the browser's time on the next render.
export function useNow(stepMs: number): number | null {
  const subscribe = useCallback(
    (onTick: () => void) => {
      const t = setInterval(onTick, stepMs)
      return () => clearInterval(t)
    },
    [stepMs]
  )
  // Rounded to the step so repeated reads within one tick return the same value.
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / stepMs) * stepMs, () => null)
}
