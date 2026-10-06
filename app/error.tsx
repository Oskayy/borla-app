'use client'

import { PageError } from '@/components/PageStatus'

// Catches errors in any app layout (ops, customer, driver), e.g. when the database can't be reached.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4">
      <PageError reset={reset} home="/" />
    </div>
  )
}
