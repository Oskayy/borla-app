import { prisma } from '@/lib/prisma'
import { getAcceptMinutes, getAutoDispatch, getShiftSettings } from '@/lib/settings'
import { addDays, formatClock } from '@/lib/shift'
import { dbDate, lastEndedShiftDate, runningShiftDate, snapshotWindowDate } from '@/lib/schedule'
import { loadDispatchDrivers, loadPlanSites } from '@/lib/dispatch-server'
import { orderLitres } from '@/lib/dispatch'
import { orderWasteKind, proposePlan, type PlanOrder } from '@/lib/planner'
import { attachOrderToDriver, type AttachableOrder } from '@/lib/reassign-server'
import { sweepExpiredOffers } from '@/lib/offers-server'
import { newStopsMessage } from '@/lib/offers'
import { notifyOps, notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'

// The night's automatic jobs. Called every 2 minutes by the scheduler, and also (at most once a minute)
// whenever driver or ops screens check for updates, so they keep running even without the scheduler.

const MIN_GAP_MS = 60_000
const MAX_ORDERS_PER_RUN = 300

let lastRun = 0
let running: Promise<JobSummary> | null = null

export interface JobSummary {
  expired: number
  planNotice: boolean
  shiftStart: boolean
  autoAssigned: number
  rolledOver: number
}

export async function runScheduledJobs(force = false): Promise<JobSummary> {
  const empty: JobSummary = { expired: 0, planNotice: false, shiftStart: false, autoAssigned: 0, rolledOver: 0 }
  if (!force && Date.now() - lastRun < MIN_GAP_MS) return empty
  if (running) return running
  lastRun = Date.now()
  running = runAll(force).finally(() => {
    running = null
  })
  return running
}

async function runAll(force: boolean): Promise<JobSummary> {
  const summary: JobSummary = { expired: 0, planNotice: false, shiftStart: false, autoAssigned: 0, rolledOver: 0 }
  const settings = await getShiftSettings()
  const now = new Date()

  // 1. Uncollected orders from a finished shift move to the next night (first, so the new night sees them).
  const ended = lastEndedShiftDate(now, settings)
  await once(`rollover:${ended}`, async () => {
    summary.rolledOver = await rollOver(ended)
    return `${summary.rolledOver} order(s) moved to ${addDays(ended, 1)}`
  })

  // 2. Stops drivers didn't accept in time go to other drivers.
  summary.expired = await sweepExpiredOffers(force)

  // 3. Planning snapshot: tell ops tonight's plan is ready.
  const planDate = snapshotWindowDate(now, settings)
  if (planDate) {
    await once(`snapshot:${planDate}`, async () => {
      summary.planNotice = true
      return planReadyNotice(planDate, formatClock(settings.shiftStartMinutes))
    })
  }

  // 4. During the shift: shift-start reminders once, then automatic assignment of anything waiting.
  const shiftDate = runningShiftDate(now, settings)
  if (shiftDate) {
    const auto = await getAutoDispatch()
    await once(`shiftstart:${shiftDate}`, async () => {
      summary.shiftStart = true
      return shiftStartNotice(shiftDate, auto)
    })
    if (auto) summary.autoAssigned = await autoDispatch(shiftDate)
  }

  return summary
}

// "Tuesday 29 Sep" for a YYYY-MM-DD date.
function nightName(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Runs a job once per key, across all servers. If the job fails, the lock is released so it retries.
async function once(key: string, job: () => Promise<string>): Promise<void> {
  try {
    await prisma.jobRun.create({ data: { key } })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2002') return // already done (or running elsewhere)
    throw err
  }
  try {
    const summary = await job()
    await prisma.jobRun.update({ where: { key }, data: { summary: summary.slice(0, 500) } })
  } catch (e) {
    console.error(`[jobs] ${key} failed`, e)
    await prisma.jobRun.delete({ where: { key } }).catch(() => {})
  }
}

function toPlanOrders(
  orders: { id: string; latitude: number | null; longitude: number | null; quoteSnapshot: unknown; createdAt: Date; declines: { driverId: string }[] }[]
): PlanOrder[] {
  return orders.map((o) => ({
    id: o.id,
    latitude: o.latitude,
    longitude: o.longitude,
    litres: orderLitres(o.quoteSnapshot).litres,
    createdAt: o.createdAt.toISOString(),
    wasteKind: orderWasteKind(o.quoteSnapshot),
    declinedBy: o.declines.map((d) => d.driverId),
  }))
}

async function waitingOrders(shiftDate: string) {
  return prisma.order.findMany({
    where: { status: 'PAID', shiftDate: { lte: dbDate(shiftDate) } },
    orderBy: [{ rolloverCount: 'desc' }, { createdAt: 'asc' }],
    take: MAX_ORDERS_PER_RUN,
    select: {
      id: true,
      latitude: true,
      longitude: true,
      quoteSnapshot: true,
      createdAt: true,
      declines: { select: { driverId: true } },
    },
  })
}

async function planReadyNotice(shiftDate: string, startLabel: string): Promise<string> {
  const orders = await waitingOrders(shiftDate)
  if (orders.length === 0) return 'no orders'
  const [{ drivers, shiftRunning, now }, sites] = await Promise.all([loadDispatchDrivers(), loadPlanSites()])
  const plan = proposePlan(drivers, toPlanOrders(orders), shiftRunning, now, sites)
  const placed = plan.drivers.reduce((n, p) => n + p.orderIds.length, 0)
  const auto = await getAutoDispatch()
  await notifyOps({
    title: "Tonight's plan is ready",
    body:
      `${orders.length} order(s): ${placed} fit across ${plan.drivers.length} driver(s)` +
      (plan.unassigned.length ? `, ${plan.unassigned.length} can't be placed yet` : '') +
      `. Review and approve on the Assign page before ${startLabel}.` +
      (auto ? ' Anything not approved is assigned automatically once the shift starts.' : ''),
    url: '/ops/assign',
  })
  return `${orders.length} orders, ${placed} placed, ${plan.unassigned.length} not placed`
}

async function shiftStartNotice(shiftDate: string, auto: boolean): Promise<string> {
  const [waiting, unaccepted, acceptMinutes] = await Promise.all([
    prisma.order.count({ where: { status: 'PAID', shiftDate: { lte: dbDate(shiftDate) } } }),
    prisma.order.groupBy({
      by: ['driverId'],
      where: { status: 'ASSIGNED', driverAcceptedAt: null, driverId: { not: null } },
      _count: { _all: true },
    }),
    getAcceptMinutes(),
  ])

  for (const g of unaccepted as { driverId: string; _count: { _all: number } }[]) {
    await notifyUser(g.driverId, {
      title: 'The shift has started',
      body: `Go online and accept your ${g._count._all} stop(s) within ${acceptMinutes} min, or they go to another driver.`,
      url: '/dashboard/driver',
    })
  }
  if (waiting > 0) {
    await notifyOps({
      title: 'Shift started with orders waiting',
      body: auto
        ? `${waiting} order(s) have no driver yet. They'll be assigned automatically as drivers come online.`
        : `${waiting} order(s) have no driver yet. Assign them on the Assign page.`,
      url: '/ops/assign',
    })
  }
  // Every customer with a pickup tonight gets a reminder to put their bins out (SMS as well).
  const tonight = await prisma.order.findMany({
    where: { status: { in: ['PAID', 'ASSIGNED'] }, shiftDate: dbDate(shiftDate) },
    select: { customerId: true },
  })
  const customers = Array.from(new Set(tonight.map((o: { customerId: string }) => o.customerId)))
  for (const c of customers) {
    await notifyUser(c as string, {
      title: 'Your pickup is tonight',
      body: 'Trashit is collecting tonight. Please put your bins out now, where the driver can reach them.',
      url: '/dashboard/customer/orders',
      sms: 'Trashit: your pickup is tonight. Please put your bins out now where the driver can reach them. Thank you!',
    })
  }

  return `${waiting} waiting, ${unaccepted.length} driver(s) reminded, ${customers.length} customer(s) reminded`
}

// Assigns waiting orders to online drivers, using the same rules as the suggested plan.
// Only plans that pass every check are used; the rest wait for the next run or for ops.
async function autoDispatch(shiftDate: string): Promise<number> {
  const orders = await waitingOrders(shiftDate)
  if (orders.length === 0) return 0
  const [{ drivers, shiftRunning, now }, sites] = await Promise.all([loadDispatchDrivers(), loadPlanSites()])
  if (!shiftRunning) return 0
  const plan = proposePlan(drivers, toPlanOrders(orders), shiftRunning, now, sites)
  const byId = new Map<string, AttachableOrder>(orders.map((o: AttachableOrder) => [o.id, o] as [string, AttachableOrder]))
  const driverById = new Map(drivers.map((d) => [d.id, d]))
  const acceptMinutes = await getAcceptMinutes()

  let total = 0
  for (const p of plan.drivers) {
    if (p.problems.length > 0) continue
    const driver = driverById.get(p.driverId)
    if (!driver) continue
    let added = 0
    for (const orderId of p.orderIds) {
      const o = byId.get(orderId)
      if (!o) continue
      try {
        await attachOrderToDriver(o, driver, sites, null, (trip, newTrip) => `Assigned automatically (trip ${trip}${newTrip ? ', new trip' : ''})`)
        added++
      } catch (err) {
        const e = caught(err)
        if (e?.message !== 'STATE_CHANGED') console.error('[jobs] auto-assign failed', orderId, e)
      }
    }
    if (added > 0) {
      total += added
      await notifyUser(driver.id, newStopsMessage(added, acceptMinutes))
    }
  }
  return total
}

// Orders from a finished night that weren't collected move to the next night, at the front of the queue.
// Stops that were on a driver's list come off it. Customers are told. Earlier declines are forgotten,
// because a driver who couldn't go last night may well be able to tonight.
async function rollOver(endedShiftDate: string): Promise<number> {
  const next = addDays(endedShiftDate, 1)
  let moved = 0

  for (;;) {
    const batch = await prisma.order.findMany({
      where: { status: { in: ['PAID', 'ASSIGNED'] }, shiftDate: { lte: dbDate(endedShiftDate) } },
      select: { id: true, customerId: true, status: true },
      take: 200,
    })
    if (batch.length === 0) break
    const ids = batch.map((o: { id: string }) => o.id)

    await prisma.$transaction(
      async (tx) => {
        await tx.order.updateMany({
          where: { id: { in: ids }, status: { in: ['PAID', 'ASSIGNED'] } },
          data: {
            status: 'PAID',
            driverId: null,
            driverAcceptedAt: null,
            offeredAt: null,
            shiftDate: dbDate(next),
            isLateOrder: false,
            rolloverCount: { increment: 1 },
            assignedNoticeAt: null,
          },
        })
        // Only remove route stops of orders that were actually moved (not ones collected a moment ago).
        await tx.routeStop.deleteMany({ where: { orderId: { in: ids }, order: { status: 'PAID' } } })
        await tx.orderDecline.deleteMany({ where: { orderId: { in: ids }, order: { status: 'PAID' } } })
        await tx.auditLog.createMany({
          data: batch.map((o: { id: string; status: string }) => ({
            orderId: o.id,
            actorId: null,
            fromState: o.status,
            toState: 'PAID',
            reason: `ROLLED OVER: not collected on the night of ${endedShiftDate}; moved to the night of ${next}`,
          })),
        })
      },
      { timeout: 30000 }
    )
    moved += ids.length

    const customers = Array.from(new Set(batch.map((o: { customerId: string }) => o.customerId)))
    for (const c of customers) {
      await notifyUser(c as string, {
        title: 'Your pickup has moved to tonight',
        body: `Sorry, we couldn't collect on ${nightName(endedShiftDate)} night. Your pickup is now booked for ${nightName(next)} night. Please leave your bins out again. There's nothing extra to pay.`,
        url: '/dashboard/customer/orders',
        sms: `Trashit: sorry, we couldn't collect last night. Your pickup is now booked for ${nightName(next)} night at no extra cost. Please put your bins out again.`,
      })
    }
    if (batch.length < 200) break
  }

  const stillOnBoard = await prisma.order.count({
    where: { status: { in: ['PICKED_UP', 'DISPOSAL_PENDING'] }, shiftDate: { lte: dbDate(endedShiftDate) } },
  })
  if (moved > 0 || stillOnBoard > 0) {
    await notifyOps({
      title: 'Night finished',
      body:
        (moved > 0 ? `${moved} order(s) weren't collected and moved to the night of ${next}. ` : '') +
        (stillOnBoard > 0 ? `${stillOnBoard} collected order(s) still haven't been confirmed as unloaded.` : ''),
      url: moved > 0 ? '/ops/assign' : '/ops/disposal-review',
    })
  }
  return moved
}
