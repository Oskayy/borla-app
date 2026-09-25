import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  DRAFT: '#999',
  PAID: 'var(--color-accent)',
  ASSIGNED: 'var(--color-accent)',
  PICKED_UP: 'var(--color-accent)',
  COMPLETED: 'var(--color-success)',
  CANCELLED: '#B3261E',
  FAILED_PICKUP: '#B3261E',
  DISPUTED: '#B3261E',
}

const statusMessages: Record<string, string> = {
  DRAFT: 'Your order is being set up.',
  PAID: "Payment received — we're finding a driver for you.",
  ASSIGNED: 'A driver has been assigned and is on the way.',
  PICKED_UP: 'Your waste has been picked up.',
  COMPLETED: 'This pickup is complete. Thank you!',
  CANCELLED: 'This order was cancelled.',
  FAILED_PICKUP: 'The driver could not complete this pickup. Support will follow up.',
  DISPUTED: 'There is an open issue with this order. Support will follow up.',
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const order = await prisma.order.findUnique({ where: { id } })

  if (!order || order.customerId !== user.id) {
    return (
      <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
        <p>Order not found.</p>
        <Link href="/dashboard/customer/orders">Back to my orders</Link>
      </div>
    )
  }

  const quote = order.quoteSnapshot as { price: number; address?: string }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Order Status</h1>

      <div className="panel">
        <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Pickup address</p>
        <p style={{ marginBottom: 16 }}>{quote?.address || 'N/A'}</p>

        <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Amount</p>
        <p style={{ fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: 16 }}>
          GHS {quote?.price?.toFixed(2)}
        </p>

        <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Status</p>
        <p style={{ marginBottom: 8 }}>
          <span className="status-dot" style={{ background: statusColors[order.status] ?? '#999' }} />
          {order.status}
        </p>
        <p style={{ fontSize: 13, color: '#666' }}>{statusMessages[order.status] ?? ''}</p>
      </div>

      <Link href="/dashboard/customer/orders" style={{ display: 'inline-block', marginTop: 16, fontSize: 14 }}>
        ← Back to my orders
      </Link>
    </div>
  )
}