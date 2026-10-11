'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useClientValue } from '@/lib/use-client-value'
import { draftRaw, markResumed, parseDraft } from '@/lib/booking-draft'

const BOOK = '/dashboard/customer/book'

// After signing up or in with a pickup already priced (lib/booking-draft.ts), go straight back to booking it.
// Only once: after that the customer moves around freely and the form still remembers it for a day.
export default function ResumeBooking() {
  const raw = useClientValue(draftRaw, '')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const draft = parseDraft(raw)
    if (!draft || draft.resumed) return
    markResumed()
    if (pathname !== BOOK) router.replace(BOOK)
  }, [raw, pathname, router])

  return null
}
