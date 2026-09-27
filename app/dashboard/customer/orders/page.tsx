import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import DeleteDraftButton from '@/components/DeleteDraftButton'

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft (not paid)',
  PAID: 'Paid — waiting for driver assignment',
  ASSIGNED: 'Driver assigned',
  PICKED_UP: 'Picked up — awaiting disposal',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const statusColors: Record<string, string> = {
  DRAFT: '#999',
  PAID: 'var(--color-accent)',
  ASSIGNED: 'var(--color-accent)',
  PICKED_UP: 'var(--color-accent)',
  COMPLETED: 'var(--color-success)',
  CANCELLED: '#B3261E',
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
    <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Your Orders</h1>
      {orders.length === 0 && <div className="panel"><p>No orders yet.</p></div>}
      {orders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        return (
          <div key={order.id} className="panel" style={{ marginBottom: 12 }}>
            <p style={{ fontWeight: 500, marginBottom: 4 }}>{quote.address}</p>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <span className="status-dot" style={{ background: statusColors[order.status] ?? '#999' }} />
              GHS {quote.price} — {statusLabels[order.status] ?? order.status}
            </p>
            <p style={{ fontSize: 12, color: '#999' }}>
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
            {order.status === 'DRAFT' && <DeleteDraftButton orderId={order.id} />}
          </div>
        )
      })}
    </div>
  )
}