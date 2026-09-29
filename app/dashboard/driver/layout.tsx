import Link from 'next/link'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        background: 'white',
      }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--color-primary)' }}>
          Borla
        </span>
        <Link href="/dashboard/driver" style={{ color: 'var(--color-ink)', textDecoration: 'none', fontSize: 14 }}>Dashboard</Link>
                <Link href="/dashboard/driver/profile-setup" style={{ color: 'var(--color-ink)', textDecoration: 'none', fontSize: 14 }}>My Vehicle &amp; Area</Link>
      </nav>
      {children}
    </div>
  )
}