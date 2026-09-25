import Link from 'next/link'

const tiles = [
  {
    href: '/ops/assign',
    title: 'Assign Orders',
    description: 'Select paid orders and assign them to drivers with optimized routes.',
    available: true,
  },
  {
    href: '/ops/exceptions',
    title: 'Exceptions',
    description: 'Review failed pickups, disputes, and flagged deliveries.',
    available: true,
  },
  {
    href: '/ops/pricing',
    title: 'Pricing Rules',
    description: 'Manage base fees, volume rates, and zone multipliers.',
    available: true,
  },
  {
    href: '/ops/payouts',
    title: 'Payout Rules',
    description: 'Configure driver payout splits for pickup and disposal.',
    available: true,
  },
]

export default function OpsDashboard() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Ops Dashboard</h1>
      <p style={{ color: '#666', marginBottom: 28 }}>Manage orders, exceptions, and platform settings.</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {tiles.map((tile) =>
          tile.available ? (
            <Link
              key={tile.title}
              href={tile.href}
              className="panel"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
            >
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 6, color: '#0F3D3E' }}>
                {tile.title}
              </h2>
              <p style={{ fontSize: 13, color: '#666' }}>{tile.description}</p>
            </Link>
          ) : (
            <div
              key={tile.title}
              className="panel"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 6, color: '#0F3D3E' }}>
                {tile.title}
              </h2>
              <p style={{ fontSize: 13, color: '#666' }}>{tile.description}</p>
              <span style={{ fontSize: 11, color: '#E8A33D', fontWeight: 600 }}>COMING SOON</span>
            </div>
          )
        )}
      </div>
    </div>
  )
}