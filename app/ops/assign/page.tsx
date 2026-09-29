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

  const drivers = dispatch.drivers.map((d) => ({
    ...d,
    lastLocationAt: d.lastLocationAt ? new Date(d.lastLocationAt).toISOString() : null,
  }))

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Assign Orders to Drivers</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        {dispatch.shiftRunning
          ? 'The shift is running: only online drivers are offered, measured from their live position.'
          : "The shift isn't running: you're planning ahead, so all active drivers are offered, measured from their home base."}{' '}
        The system suggests the best driver for every order, grouped into trips that fill each vehicle to about 90%.
        Check it, move any orders you want to change, then approve. Nothing is assigned until you approve.
      </p>
      {(() => {
        const bounced = orders.filter((o) => o.declinedBy.length > 0).length
        return bounced > 0 ? (
          <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid #B3261E' }}>
            <p style={{ fontSize: 14 }}>
              <strong>{bounced}</strong> order(s) were declined or not accepted in time, and no other driver could take them
              automatically. They are in the plan below; drivers who turned them down are skipped.
            </p>
          </div>
        ) : null
      })()}
      {laterCount > 0 && (
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          {laterCount} paid order(s) are booked for a later night and aren&apos;t shown. They appear here on their night.
        </p>
      )}
      {orders.length === 0 && (
        <div className="panel">
          <p>No paid orders waiting for assignment.</p>
        </div>
      )}
      {orders.length > 0 && (
        <>
          <PlanBoard
            orders={orders}
            drivers={drivers}
            sites={sites}
            shiftRunning={dispatch.shiftRunning}
            nowIso={dispatch.now.toISOString()}
          />

          <details style={{ marginTop: 24 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Assign manually instead
            </summary>
            <OptimizeForm orders={orders} drivers={drivers} shiftRunning={dispatch.shiftRunning} nowIso={dispatch.now.toISOString()} />
          </details>
        </>
      )}
    </div>
  )
}
