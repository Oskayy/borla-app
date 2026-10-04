import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking, describeCollection } from '@/lib/shift'
import { customerCancelCheck } from '@/lib/refunds'
import CancelOrderButton from '@/components/CancelOrderButton'

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
  PAID: "Payment received — your pickup is scheduled.",
  ASSIGNED: 'A driver has been assigned to your pickup.',
  DISPOSAL_PENDING: 'Your waste has been picked up and taken for disposal.',
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

  const order = await prisma.order.findUnique({
    where: { id },
    include: { refunds: { orderBy: { createdAt: 'desc' }, select: { id: true, amount: true, status: true, createdAt: true } } },
  })

  if (!order || order.customerId !== user.id) {
    return (
      <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
        <p>Order not found.</p>
        <Link href="/dashboard/customer/orders">Back to my orders</Link>
      </div>
    )
  }

  const quote = order.quoteSnapshot as {
    price: number
    address?: string
    zoneName?: string
    lines?: { code: string; label: string; count: number }[]
  }

  // Once paid, the order has a collection night. Show it in plain words.
  let collection: string | null = null
  const settings = await getShiftSettings()
  const cancelCheck = customerCancelCheck(order, new Date(), settings)
  if (order.shiftDate) {
    const today = classifyBooking(new Date(), settings).localDate
    collection = describeCollection(order.shiftDate.toISOString().slice(0, 10), today, settings)
  }
  const binsText = quote?.lines?.map((l) => `${l.count} × ${l.label}`).join(', ')

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Order Status</h1>

      <div className="panel">
        <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Pickup address</p>
        <p style={{ marginBottom: 16 }}>{quote?.address || 'N/A'}</p>

        {binsText && (
          <>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Bins</p>
            <p style={{ marginBottom: 16 }}>{binsText}</p>
          </>
        )}

        {collection && ['PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(order.status) && (
          <div style={{ background: '#EEF4F4', borderRadius: 4, padding: 10, marginBottom: 16, fontSize: 13 }}>
            <strong>Collection: {collection}.</strong>
            <br />
            Please put your bins out before the collection starts.
          </div>
        )}

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

        {order.refunds.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Refunds</p>
            {order.refunds.map((r: { id: string; amount: number; status: string; createdAt: Date }) => (
              <p key={r.id} style={{ fontSize: 14 }}>
                GHS {r.amount.toFixed(2)} ·{' '}
                {r.status === 'PROCESSED'
                  ? 'sent back to your account'
                  : r.status === 'FAILED'
                  ? 'could not be sent; Trashit support will contact you'
                  : 'on its way (usually a few working days)'}
              </p>
            ))}
          </div>
        )}

        {cancelCheck.ok && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <CancelOrderButton orderId={order.id} amount={quote?.price ?? 0} />
          </div>
        )}
      </div>

      <Link href="/dashboard/customer/orders" style={{ display: 'inline-block', marginTop: 16, fontSize: 14 }}>
        ← Back to my orders
      </Link>
    </div>
  )
}