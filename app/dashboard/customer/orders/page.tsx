import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft (not paid)',
  PAID: 'Paid — waiting for driver assignment',
  ASSIGNED: 'Driver assigned',
  PICKED_UP: 'Picked up — awaiting disposal',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export default async function OrderHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div style={{ maxWidth: 500, margin: '60px auto', padding: 20 }}>
      <h1>Your Orders</h1>
      {orders.length === 0 && <p>No orders yet.</p>}
      {orders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        return (
          <div key={order.id} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
            <p><strong>{quote.address}</strong></p>
            <p>GHS {quote.price} — {statusLabels[order.status] ?? order.status}</p>
            <p style={{ fontSize: 12, color: '#666' }}>
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        )
      })}
    </div>
  )
}