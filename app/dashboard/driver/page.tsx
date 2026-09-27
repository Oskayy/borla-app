import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ConfirmPickupButton from './confirm-pickup-button'
import ConfirmDisposalButton from './confirm-disposal-button'
import DriverLocationTracker from '@/components/DriverLocationTracker'

export default async function DriverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: user.id } })

  if (!driverProfile || !driverProfile.vehicleType) {
    redirect('/dashboard/driver/profile-setup')
  }

  const orders = await prisma.order.findMany({
    where: {
      driverId: user.id,
      status: { in: ['ASSIGNED', 'PICKED_UP'] },
    },
    include: { routeStop: true },
    orderBy: { routeStop: { sequence: 'asc' } },
  })

  const earningsEntries = await prisma.ledgerEntry.findMany({
    where: {
      type: { in: ['driver_payout_pickup', 'driver_payout_disposal'] },
      order: { driverId: user.id },
    },
  })

  const totalEarnings = earningsEntries.reduce((sum, entry) => sum + entry.amount, 0)

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Driver Dashboard</h1>
      <DriverLocationTracker />

      <div className="panel" style={{ marginBottom: 24, background: 'var(--color-primary)', border: 'none', color: 'white' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Total earnings</p>
        <p style={{ margin: 0, fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
          GHS {totalEarnings.toFixed(2)}
        </p>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12, color: '#666' }}>Active Orders</h2>

      {orders.length === 0 && <div className="panel"><p>No active orders right now.</p></div>}
      {orders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        return (
          <div key={order.id} className="panel" style={{ marginBottom: 12 }}>
            {order.routeStop && (
              <p style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 600, marginBottom: 2 }}>
                STOP {order.routeStop.sequence}
              </p>
            )}
            <p style={{ fontWeight: 500, marginBottom: 4 }}>{quote.address}</p>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>GHS {quote.price}</p>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              <span className="status-dot" style={{ background: 'var(--color-accent)' }} />
              {order.status}
            </p>
            {order.status === 'ASSIGNED' && <ConfirmPickupButton orderId={order.id} />}
            {order.status === 'PICKED_UP' && <ConfirmDisposalButton orderId={order.id} />}
          </div>
        )
      })}
    </div>
  )
}