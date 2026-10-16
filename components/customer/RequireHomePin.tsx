'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Setting the home pin is the first step for a new customer: until it is saved and confirmed, every customer page
// sends them to the Home pin page. Settings, profile and alerts stay open so they can still manage their account.
const ALLOWED = ['/dashboard/customer/home-location', '/dashboard/customer/settings', '/dashboard/customer/profile', '/dashboard/customer/more', '/dashboard/customer/notifications']

export default function RequireHomePin({ hasPin }: { hasPin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const blocked = !hasPin && !ALLOWED.some((p) => pathname.startsWith(p))
  useEffect(() => {
    if (blocked) router.replace('/dashboard/customer/home-location')
  }, [blocked, router])
  return null
}
