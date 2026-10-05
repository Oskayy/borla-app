'use client'

import { PageError } from '@/components/PageStatus'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <PageError reset={reset} home="/dashboard/driver" />
}
