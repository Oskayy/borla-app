import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EXCEPTION_ROLES } from '@/lib/exceptions'
import { REFUND_ROLES, LIVE_REFUND_STATUSES, refundable } from '@/lib/refunds'
import ExceptionsClient, { type ExceptionItem, type RefundRow } from '@/components/ExceptionsClient'

export const dynamic = 'force-dynamic'

type Snap = { address?: string; price?: number } | null

export default async function ExceptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !EXCEPTION_ROLES.includes(dbUser.role)) redirect('/dashboard')
  const canRefund = REFUND_ROLES.includes(dbUser.role)

  const paymentSelect = {
    select: { id: true, amount: true, status: true, refunds: { select: { amount: true, status: true } } },
    orderBy: { createdAt: 'asc' as const },
  }

  const [flagged, gps, paymentProblems, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ['FAILED_PICKUP', 'DISPUTED'] } },
      include: {
        customer: { select: { name: true, phone: true } },
        driver: { select: { name: true } },
        disputes: { where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        payments: paymentSelect,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    // Pickups that went through, but the driver's photo was further from the pin than expected.
    prisma.order.findMany({
      where: {
        auditLogs: { some: { reason: { contains: 'GPS MISMATCH' } }, none: { reason: { startsWith: 'GPS REVIEWED' } } },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        driver: { select: { name: true } },
        auditLogs: { where: { reason: { contains: 'GPS MISMATCH' } }, orderBy: { createdAt: 'desc' }, take: 1 },
        payments: paymentSelect,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    // Payments that didn't match the price, or arrived twice.
    prisma.order.findMany({
      where: {
        auditLogs: {
          some: { OR: [{ reason: { startsWith: 'PAYMENT AMOUNT MISMATCH' } }, { reason: { startsWith: 'DUPLICATE OR LATE PAYMENT' } }] },
          none: { reason: { startsWith: 'PAYMENT PROBLEM RESOLVED' } },
        },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        driver: { select: { name: true } },
        auditLogs: {
          where: { OR: [{ reason: { startsWith: 'PAYMENT AMOUNT MISMATCH' } }, { reason: { startsWith: 'DUPLICATE OR LATE PAYMENT' } }] },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        payments: paymentSelect,
      },
      take: 50,
    }),
    prisma.refund.findMany({
      where: { OR: [{ status: { in: ['PENDING', 'PROCESSING', 'NEEDS_ATTENTION', 'FAILED'] } }, { createdAt: { gte: new Date(Date.now() - 14 * 86400000) } }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { order: { select: { id: true, quoteSnapshot: true, customer: { select: { name: true } } } } },
    }),
  ])

  function toItem(o: any, kind: ExceptionItem['kind'], reason: string): ExceptionItem {
    const snap = o.quoteSnapshot as Snap
    return {
      kind,
      orderId: o.id,
      status: o.status,
      address: snap?.address ?? 'No address',
      price: snap?.price ?? null,
      customerName: o.customer?.name ?? '',
      customerPhone: o.customer?.phone ?? '',
      driverName: o.driver?.name ?? null,
      reason,
      updatedAt: o.updatedAt.toISOString(),
      payments: (o.payments ?? []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        refundable: refundable(
          p.amount,
          p.refunds.filter((r: any) => LIVE_REFUND_STATUSES.includes(r.status)).map((r: any) => r.amount)
        ),
      })),
    }
  }

  const items: ExceptionItem[] = [
    ...flagged.map((o: any) => toItem(o, 'flagged', o.disputes[0]?.reason ?? o.auditLogs[0]?.reason ?? 'No reason recorded')),
    ...paymentProblems.map((o: any) => toItem(o, 'payment', o.auditLogs[0]?.reason ?? 'Payment problem')),
    ...gps.map((o: any) => toItem(o, 'gps', o.auditLogs[0]?.reason ?? 'GPS mismatch')),
  ]
  const refundRows: RefundRow[] = refunds.map((r: any) => ({
    id: r.id,
    orderId: r.orderId,
    address: (r.order.quoteSnapshot as Snap)?.address ?? 'No address',
    customerName: r.order.customer?.name ?? '',
    amount: r.amount,
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Exceptions</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Failed pickups, disputes, payment problems and GPS mismatches. Every decision needs a short note, which is kept
        on the order&apos;s history.{canRefund ? '' : ' Refunds need a Finance, Ops Manager or Super Admin account.'}
      </p>
      <ExceptionsClient items={items} refunds={refundRows} canRefund={canRefund} />
    </div>
  )
}
