import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ConfirmPickupButton from './confirm-pickup-button'
import ConfirmDisposalButton from './confirm-disposal-button'

export default async function DriverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orders = await prisma.order.findMany({
    where: {
      driverId: user.id,
      status: { in: ['ASSIGNED', 'PICKED_UP'] },
    },
  })

  // Sum up every payout ever recorded for this driver's completed work
  const earningsEntries = await prisma.ledgerEntry.findMany({
    where: {
      type: { in: ['driver_payout_pickup', 'driver_payout_disposal'] },
      order: { driverId: user.id },
    },
  })

  const totalEarnings = earningsEntries.reduce((sum, entry) => sum + entry.amount, 0)

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Driver Dashboard</h1>

      <div style={{ background: '#f0f0f0', padding: 15, marginBottom: 20, borderRadius: 4 }}>
        <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Total earnings</p>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>GHS {totalEarnings.toFixed(2)}</p>
      </div>

      <h2 style={{ fontSize: 18 }}>Active Orders</h2>
      {orders.length === 0 && <p>No active orders right now.</p>}
      {orders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        return (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
            <p><strong>Pickup at:</strong> {quote.address}</p>
            <p><strong>Price:</strong> GHS {quote.price}</p>
            <p><strong>Status:</strong> {order.status}</p>
            {order.status === 'ASSIGNED' && <ConfirmPickupButton orderId={order.id} />}
            {order.status === 'PICKED_UP' && <ConfirmDisposalButton orderId={order.id} />}
          </div>
        )
      })}
    </div>
  )
}