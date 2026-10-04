import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify'

// Keeps customers told where their pickup is at. Never throws.

function addressOf(snapshot: unknown): string {
  return (snapshot as { address?: string } | null)?.address ?? 'your address'
}

// "A driver has been assigned" - once per night (reset when an order moves to another night).
export async function notifyCustomersAssigned(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return
  try {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, status: 'ASSIGNED', assignedNoticeAt: null },
      select: { id: true, customerId: true, quoteSnapshot: true },
    })
    for (const o of orders) {
      const claimed = await prisma.order.updateMany({ where: { id: o.id, assignedNoticeAt: null }, data: { assignedNoticeAt: new Date() } })
      if (claimed.count !== 1) continue
      await notifyUser(o.customerId, {
        title: 'Driver assigned',
        body: `A Trashit driver has been assigned to your pickup at ${addressOf(o.quoteSnapshot)}. Please make sure your bins are out.`,
        url: `/dashboard/customer/orders/${o.id}`,
      })
    }
  } catch (e) {
    console.error('[customer-updates] assigned notice failed', e)
  }
}

export async function notifyCustomerCollected(orderId: string): Promise<void> {
  try {
    const o = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, quoteSnapshot: true } })
    if (!o) return
    await notifyUser(o.customerId, {
      title: 'Bins collected',
      body: `Your waste at ${addressOf(o.quoteSnapshot)} has been collected. Thank you for using Trashit.`,
      url: `/dashboard/customer/orders/${orderId}`,
      sms: 'Trashit: your waste has been collected. Thank you!',
    })
  } catch (e) {
    console.error('[customer-updates] collected notice failed', e)
  }
}

export async function notifyCustomersCompleted(orderIds: string[]): Promise<void> {
  try {
    const orders = await prisma.order.findMany({ where: { id: { in: orderIds }, status: 'COMPLETED' }, select: { id: true, customerId: true } })
    for (const o of orders) {
      await notifyUser(o.customerId, {
        title: 'Pickup complete',
        body: 'Your waste has been taken to an approved disposal site. This pickup is complete.',
        url: `/dashboard/customer/orders/${o.id}`,
      })
    }
  } catch (e) {
    console.error('[customer-updates] completed notice failed', e)
  }
}
