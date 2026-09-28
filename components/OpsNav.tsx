'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/ops', label: 'Dashboard' },
  { href: '/ops/assign', label: 'Assign Orders' },
  { href: '/ops/exceptions', label: 'Exceptions' },
  { href: '/ops/pricing', label: 'Pricing Rules' },
  { href: '/ops/payouts', label: 'Payout Rules' },
  { href: '/ops/mfa-recovery', label: '2FA Recovery' },
  { href: '/ops/zones', label: 'Zones' },
  { href: '/ops/shift', label: 'Shift Hours' },
]

export default function OpsNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        background: '#0F3D3E',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 18,
          marginRight: 12,
        }}
      >
        Borla Ops
      </span>

      {links.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: active ? '#E8A33D' : '#fff',
              fontWeight: active ? 600 : 400,
              fontSize: 14,
              textDecoration: 'none',
              borderBottom: active ? '2px solid #E8A33D' : '2px solid transparent',
              paddingBottom: 4,
            }}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}