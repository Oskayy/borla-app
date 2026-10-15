'use client'

import { useSyncExternalStore } from 'react'

// Renders its children only when the media query matches (after the page loads), so something that should sit in
// different places on a phone and a computer (like a map) is built once, in the right place.
export default function ShowAt({ query, children, fallback = null }: { query: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  const matches = useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => null
  )
  if (matches === null) return fallback
  return matches ? children : null
}
