import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  DRAFT: '#999',
  PAID: 'var(--color-accent)',
  ASSIGNED: 'var(--color-accent)',
  PICKED_UP: 'var(--color-accent)',
  COMPLETED: 'var(--color-success)',
  CANCELLED: '#B3261E',
}

export default async function CustomerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

    const [lastOrder, profile] = await Promise.all([
    prisma.order.findFirst({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { homeLat: true } }),
  ])
  const hasHome = profile?.homeLat != null

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Welcome, {dbUser?.name}</h1>
            {!hasHome && (
        <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid var(--color-accent)' }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Set your home location</p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
            Pin your house on the map once, and every booking will use it. It also helps drivers find you at night.
          </p>
          <Link href="/dashboard/customer/home-location" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Set my home
          </Link>
        </div>
      )}
      {lastOrder ? (
        <div className="panel">
          <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Most recent order</p>
          <p style={{ marginBottom: 8 }}>{(lastOrder.quoteSnapshot as any)?.address}</p>
          <p style={{ fontSize: 14 }}>
            <span className="status-dot" style={{ background: statusColors[lastOrder.status] ?? '#999' }} />
            {lastOrder.status}
          </p>
        </div>
      ) : (
        <div className="panel">
          <p>You haven't booked a pickup yet.</p>
        </div>
      )}
    </div>
  )
}