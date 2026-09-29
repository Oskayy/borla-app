import Link from 'next/link'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
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
        <Link href="/dashboard/customer" style={{ color: 'var(--color-ink)', textDecoration: 'none', fontSize: 14 }}>Home</Link>
        <Link href="/dashboard/customer/book" style={{ color: 'var(--color-ink)', textDecoration: 'none', fontSize: 14 }}>Book a Pickup</Link>
        <Link href="/dashboard/customer/orders" style={{ color: 'var(--color-ink)', textDecoration: 'none', fontSize: 14 }}>My Orders</Link>
                <Link href="/dashboard/customer/home-location" style={{ color: 'var(--color-ink)', textDecoration: 'none', fontSize: 14 }}>My Home</Link>
      </nav>
      {children}
    </div>
  )
}