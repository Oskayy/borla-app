'use client'

import { useSyncExternalStore } from 'react'

const noSubscribe = () => () => {}

// Reads something only the browser knows (feature support, localStorage, the URL) without a
// setState-in-effect. The server render and hydration use `serverValue`; React then re-renders
// once with the browser's value. `read` must return a primitive (or the same object each time).
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue)
}
