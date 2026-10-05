import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Check, FileDown, Moon, Truck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking, describeCollection, type ShiftSettings } from '@/lib/shift'
import { customerCancelCheck } from '@/lib/refunds'
import { binsText, CUSTOMER_STAGES, customerStatus, ghs, type OrderSnapshot } from '@/lib/order-status'
import { dateLabel, dateTimeLabel } from '@/lib/format'
import { BUTTON_QUIET, Card, CardTitle, StatusPill } from '@/components/customer/ui'
import CancelOrderButton from '@/components/CancelOrderButton'

export const dynamic = 'force-dynamic'

// The audit-log states that mark each customer stage, so the timeline can show when it happened.
const STAGE_STATES: string[][] = [['PAID'], ['ASSIGNED'], ['PICKED_UP', 'PICKUP_PENDING_REVIEW'], ['DISPOSAL_VERIFIED', 'COMPLETED']]

// Reads the clock, so it lives outside the component.
function details(order: { status: string; shiftDate: Date | null }, s: ShiftSettings) {
  const now = new Date()
  const cancel = customerCancelCheck(order, now, s)
  const collection = order.shiftDate
    ? describeCollection(order.shiftDate.toISOString().slice(0, 10), classifyBooking(now, s).localDate, s)
    : null
  return { cancel, collection }
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      refunds: {
        // Staff refunds still waiting for, or turned down at, the second approval never reached the customer.
        where: { NOT: [{ status: 'AWAITING_APPROVAL' }, { status: 'FAILED', approvedBy: { not: null } }] },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, status: true, createdAt: true },
      },
      auditLogs: { orderBy: { createdAt: 'asc' }, select: { toState: true, createdAt: true } },
      driver: { select: { name: true, driverProfile: { select: { vehicleType: true } } } },
      payments: { where: { status: { in: ['success', 'partially_refunded', 'refunded'] } }, select: { id: true }, take: 1 },
    },
  })

  if (!order || order.customerId !== user.id) {
    return (
      <Card className="text-center">
        <p className="font-semibold">Order not found</p>
        <Link href="/dashboard/customer/orders" className="mt-3 inline-block text-sm font-semibold text-customer-deep hover:underline">
          Back to my orders
        </Link>
      </Card>
    )
  }

  const quote = order.quoteSnapshot as OrderSnapshot | null
  const status = customerStatus(order.status)
  const { cancel, collection } = details(order, await getShiftSettings())
  const stageTimes = STAGE_STATES.map((states) => order.auditLogs.find((l) => states.includes(l.toState))?.createdAt ?? null)
  const waitingForNight = ['PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(order.status)

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/customer/orders" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> My orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-bold leading-tight tracking-[-0.025em]">{binsText(quote) || 'Pickup'}</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            Booked {dateLabel(order.createdAt)} · <span className="tabular-nums">{ghs(quote?.price)}</span>
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="grid gap-6">
        <Card>
          <p className="text-lg font-semibold tracking-tight">{status.message}</p>
          {collection && waitingForNight && (
            <p className="mt-3 flex items-start gap-2.5 rounded-control bg-ops-wash p-3.5 text-sm text-ink">
              <Moon aria-hidden className="mt-0.5 size-4 shrink-0 text-ops" />
              <span>
                <strong className="font-semibold">Collection: {collection}.</strong> Please put your bins out before the collection starts.
              </span>
            </p>
          )}

          {status.stage >= 0 && (
            <ol className="mt-6 grid gap-0" aria-label="Pickup timeline">
              {CUSTOMER_STAGES.map((label, i) => {
                const done = i <= status.stage
                const t = stageTimes[i]
                return (
                  <li key={label} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < CUSTOMER_STAGES.length - 1 && (
                      <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${i < status.stage ? 'bg-customer' : 'bg-line'}`} />
                    )}
                    <span
                      className={`relative grid size-7 shrink-0 place-items-center rounded-full ${
                        done ? 'bg-customer text-white' : 'bg-surface text-ink-3 ring-2 ring-line'
                      }`}
                    >
                      {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <span className="text-xs font-semibold">{i + 1}</span>}
                    </span>
                    <span className="pt-0.5">
                      <span className={`block font-semibold ${done ? 'text-ink' : 'text-ink-3'}`}>{label}</span>
                      {done && t && <span className="block text-sm text-ink-3">{dateTimeLabel(t)}</span>}
                      <span className="sr-only">{done ? '(done)' : '(not yet)'}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle>Details</CardTitle>
          <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-3">Pickup address</dt>
              <dd className="mt-0.5 font-medium">{quote?.address || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Area</dt>
              <dd className="mt-0.5 font-medium">{quote?.zoneName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Bins</dt>
              <dd className="mt-0.5 font-medium">{binsText(quote) || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Amount</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums">{ghs(quote?.price)}</dd>
            </div>
            {order.driver && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-ink-3">Driver</dt>
                <dd className="mt-1 flex items-center gap-2.5 font-medium">
                  <span className="grid size-8 place-items-center rounded-full bg-driver text-night">
                    <Truck aria-hidden className="size-4" />
                  </span>
                  {order.driver.name.split(/\s+/)[0]}
                  {order.driver.driverProfile?.vehicleType && <span className="font-normal text-ink-3">· {order.driver.driverProfile.vehicleType}</span>}
                </dd>
              </div>
            )}
          </dl>

          {order.payments.length > 0 && (
            <div className="mt-6">
              <a href={`/api/orders/${order.id}/receipt`} download className={BUTTON_QUIET}>
                <FileDown aria-hidden className="size-4" /> Download receipt (PDF)
              </a>
            </div>
          )}

          {order.refunds.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-semibold">Refunds</h3>
              <ul className="mt-2 grid gap-1.5 text-[15px]">
                {order.refunds.map((r) => (
                  <li key={r.id}>
                    <span className="font-semibold tabular-nums">{ghs(r.amount)}</span>{' '}
                    <span className="text-ink-2">
                      {r.status === 'PROCESSED'
                        ? 'sent back to your account'
                        : r.status === 'FAILED'
                          ? 'could not be sent; Trashit support will contact you'
                          : 'on its way (usually a few working days)'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cancel.ok && (
            <div className="mt-6 border-t border-line pt-5">
              <CancelOrderButton orderId={order.id} amount={quote?.price ?? 0} />
              <p className="mt-2 text-sm text-ink-3">You can cancel for a full refund until your collection night starts.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
