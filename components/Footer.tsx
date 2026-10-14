'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pages that draw their own footer (the landing page, sign-in), and the apps, which have none.
const OWN_FOOTER = ['/', '/login', '/signup', '/forgot-password', '/reset-password']
const OWN_FOOTER_SECTIONS = ['/dashboard/customer', '/dashboard/driver', '/ops', '/account', '/security', '/signup/', '/preview']

export default function Footer() {
  const pathname = usePathname()
  if (OWN_FOOTER.includes(pathname) || OWN_FOOTER_SECTIONS.some((s) => pathname.startsWith(s))) return null
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: '20px',
        marginTop: 40,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 8,
        }}
      >
        <Link href="/privacy-policy" style={{ fontSize: 13, color: 'var(--color-ink-2)', textDecoration: 'none' }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ fontSize: 13, color: 'var(--color-ink-2)', textDecoration: 'none' }}>
          Terms & Conditions
        </Link>
        <Link href="/cookie-policy" style={{ fontSize: 13, color: 'var(--color-ink-2)', textDecoration: 'none' }}>
          Cookie Policy
        </Link>
        <Link href="/refund-policy" style={{ fontSize: 13, color: 'var(--color-ink-2)', textDecoration: 'none' }}>
          Refund Policy
        </Link>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-ink-3)', margin: 0 }}>
        © {new Date().getFullYear()} Trashit. All rights reserved.
      </p>
    </footer>
  )
}