'use client'

import { usePathname } from 'next/navigation'
import SiteFooter from '@/components/landing/SiteFooter'

// The website footer on public pages. Pages that draw their own (the landing page, sign-in) and the apps have none.
const OWN_FOOTER = ['/', '/login', '/signup', '/forgot-password', '/reset-password']
const OWN_FOOTER_SECTIONS = ['/dashboard/customer', '/dashboard/driver', '/ops', '/account', '/security', '/signup/', '/preview']

export default function Footer() {
  const pathname = usePathname()
  if (OWN_FOOTER.includes(pathname) || OWN_FOOTER_SECTIONS.some((s) => pathname.startsWith(s))) return null
  return <SiteFooter />
}
