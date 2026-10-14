import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { loadDispatchDrivers, loadPlanSites } from '@/lib/dispatch-server'
import { orderWasteKind } from '@/lib/planner'
import { orderLitres } from '@/lib/dispatch'
import OptimizeForm from './optimize-form'
import PlanBoard from '@/components/PlanBoard'
import { runScheduledJobs } from '@/lib/nightly-jobs'
import { plannableOrderFilter } from '@/lib/schedule'
import { getShiftSettings } from '@/lib/settings'
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { loadAssignedRoutes } from '@/lib/assigned-routes'
import TonightMap from '@/components/ops/TonightMap'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

export const dynamic = 'force-dynamic'

export default async function AssignOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) {
    redirect('/dashboard')
  }

  // Run the night's automatic jobs first (expired stops, rollover...), so this page shows what still needs a driver.
  await runScheduledJobs().catch((e) => console.error('[assign] scheduled jobs failed', e))

  // Only tonight's orders (and any older ones). Orders already booked for a later night wait for that night.
  const settings = await getShiftSettings()
  const tonight = plannableOrderFilter(new Date(), settings)
  const [paidOrders, dispatch, sites, laterCount] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'PAID', ...tonight },
      orderBy: [{ shiftDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        customer: { select: { name: true } },
        zone: { select: { name: true } },
        declines: { select: { driverId: true } },
      },
    }),
    loadDispatchDrivers(),
    loadPlanSites(),
    prisma.order.count({ where: { status: 'PAID', NOT: tonight } }),
  ])

  const orders = paidOrders.map((o) => {
    const snap = o.quoteSnapshot as { address?: string; price?: number } | null
    const { litres, estimated } = orderLitres(o.quoteSnapshot)
    return {
      id: o.id,
      address: snap?.address ?? 'No address',
      price: snap?.price ?? null,
      customerName: o.customer.name,
      zoneName: o.zone?.name ?? null,
      latitude: o.latitude,
      longitude: o.longitude,
      litres,
      litresEstimated: estimated,
      shiftDate: o.shiftDate ? o.shiftDate.toISOString().slice(0, 10) : null,
      isLate: o.isLateOrder,
      createdAt: o.createdAt.toISOString(),
      wasteKind: orderWasteKind(o.quoteSnapshot),
      declinedBy: o.declines.map((d: { driverId: string }) => d.driverId),
      rolloverCount: o.rolloverCount,
    }
  })

  // Routes already given to drivers tonight, for the map.
  const assigned = await loadAssignedRoutes(dispatch.drivers, dispatch.shiftRunning, dispatch.now)

  const drivers = dispatch.drivers.map((d) => ({
    ...d,
    lastLocationAt: d.lastLocationAt ? new Date(d.lastLocationAt).toISOString() : null,
  }))

  const bounced = orders.filter((o) => o.declinedBy.length > 0).length

  return (
    <div>
      <PageHeader
        title="Plan & assign"
        lead={`${
          dispatch.shiftRunning
            ? 'The shift is running: only online drivers are offered, measured from their live position.'
            : "The shift isn't running: you're planning ahead, so every active driver working tonight is offered, measured from their home base."
        } Trashit suggests a driver for every order, in trips that fill each vehicle to about 90% and fit in the driver’s shift. Check it, move anything you want, then approve. Nothing is assigned until you approve.`}
      />
      <div className="grid gap-4">
        {bounced > 0 && (
          <p className="flex items-start gap-2 rounded-card bg-danger-wash p-4 text-[15px] text-ink sm:px-5">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              <strong className="font-semibold">
                {bounced} {bounced === 1 ? 'order was' : 'orders were'} declined or not accepted in time
              </strong>
              , and no other driver could take {bounced === 1 ? 'it' : 'them'} automatically. They&apos;re in the plan below; drivers who turned
              them down are skipped.
            </span>
          </p>
        )}
        {laterCount > 0 && (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <CalendarClock aria-hidden className="size-4" />
            {laterCount} paid {laterCount === 1 ? 'order is' : 'orders are'} booked for a later night and not shown. They appear here on their night.
          </p>
        )}
        {orders.length === 0 && (
          <>
            <p className="flex items-center gap-2.5 rounded-card bg-surface p-5 text-[15px] text-ink-2 ring-1 ring-line">
              <CheckCircle2 aria-hidden className="size-5 text-action-deep" /> No paid orders waiting for a driver.
              {assigned.length > 0 && (assigned.length === 1 ? " Tonight's route is on the map." : " Tonight's routes are on the map.")}
            </p>
            {assigned.length > 0 && <TonightMap routes={assigned} />}
          </>
        )}
        {orders.length > 0 && (
          <>
            <PlanBoard
              orders={orders}
              drivers={drivers}
              sites={sites}
              shiftRunning={dispatch.shiftRunning}
              nowIso={dispatch.now.toISOString()}
              assigned={assigned}
            />

            <details className="group mt-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-action-deep">
                <ChevronRight aria-hidden className="size-4 transition group-open:rotate-90" /> Assign manually instead
              </summary>
              <div className="mt-3">
                <OptimizeForm orders={orders} drivers={drivers} shiftRunning={dispatch.shiftRunning} nowIso={dispatch.now.toISOString()} />
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
