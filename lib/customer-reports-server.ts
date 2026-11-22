import { prisma } from '@/lib/prisma'
import { dbDate } from '@/lib/schedule'
import { notifyUser } from '@/lib/notify'

export const CUSTOMER_CHECK_MINUTES = 8 * 60 // 8am: customers collected last night are asked how it went

// The morning after a night: every customer whose bins were collected is asked whether all went well, with a link to
// report a problem (lib/customer-reports.ts). A problem holds the driver's pay for that order until ops deal with it.
export async function customerCheckPrompt(shiftDate: string): Promise<string> {
  const orders = await prisma.order.findMany({
    where: { shiftDate: dbDate(shiftDate), status: { in: ['PICKED_UP', 'DISPOSAL_PENDING', 'COMPLETED'] } },
    select: { id: true, customerId: true },
  })
  const seen = new Set<string>()
  for (const o of orders) {
    if (seen.has(o.customerId)) continue
    seen.add(o.customerId)
    await notifyUser(o.customerId, {
      title: 'Was your pickup done?',
      body: 'Our driver collected last night. If anything was missed or spilled, tell us on your order page today.',
      url: `/dashboard/customer/orders/${o.id}`,
    })
  }
  return `${seen.size} customer(s) asked`
}
