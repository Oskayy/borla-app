import { prisma } from '@/lib/prisma'
import { getAcceptMinutes, getAutoDispatch, getShiftSettings } from '@/lib/settings'
import { addDays, formatClock, localParts } from '@/lib/shift'
import { dbDate, lastEndedShiftDate, runningShiftDate, snapshotWindowDate } from '@/lib/schedule'
import { loadDispatchDrivers, loadPlanSites } from '@/lib/dispatch-server'
import { orderLitres } from '@/lib/dispatch'
import { orderWasteKind, proposePlan, type PlanOrder } from '@/lib/planner'
import { attachOrderToDriver, type AttachableOrder } from '@/lib/reassign-server'
import { sweepExpiredOffers } from '@/lib/offers-server'
import { newStopsMessage } from '@/lib/offers'
import { notifyOps, notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { dateLabel } from '@/lib/format'
import { RECONCILE_MINUTES } from '@/lib/reconcile'
import { reconcileDay, syncSettlements } from '@/lib/reconcile-server'
import { SWEEP_MINUTES, TOPUP_CHECK_MINUTES } from '@/lib/treasury'
import { morningTopUpCheck, runDailySweep } from '@/lib/treasury-server'
import { RETENTION_CLEANUP_ON } from '@/lib/retention'
import { retentionSummary, runRetention } from '@/lib/retention-server'
import { worksNight } from '@/lib/availability'
import { pauseRepeatMissers } from '@/lib/driver-misses-server'
import { checkRecentCheckouts } from '@/lib/payment-confirm-server'
import { customerCheckPrompt, CUSTOMER_CHECK_MINUTES } from '@/lib/customer-reports-server'
import { overridesDigest } from '@/lib/overrides-server'

// "1 order", "3 orders": for messages people read.
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The night's automatic jobs. Called every 2 minutes by the scheduler, and also (at most once a minute)
// whenever driver or ops screens check for updates, so they keep running even without the scheduler.

const MIN_GAP_MS = 60_000
const MAX_ORDERS_PER_RUN = 300
export const REMIND_BEFORE_MINUTES = 15 // drivers working tonight are reminded this long before the shift starts
export const REFUND_OFFER_ROLLOVERS = 2 // after this many missed nights the customer is offered a refund and ops are told

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
  // Everyone still online from that night goes offline (a closed app or a flat battery used to leave drivers looking
  // online the next night). Drivers with extra hours from ops keep them.
  await once(`offline:${ended}`, async () => `${await switchEveryoneOffline(now)} driver(s) switched offline`)
  // Drivers who keep accepting stops and not collecting them are paused for ops to talk to (lib/driver-misses-server.ts).
  await once(`misses:${ended}`, async () => `${await pauseRepeatMissers(now)} driver(s) paused`)

  // 2. Stops drivers didn't accept in time go to other drivers.
  summary.expired = await sweepExpiredOffers(force)

  // 2b. Checkouts whose Paystack message hasn't arrived: ask Paystack directly (lib/payment-confirm-server.ts).
  if (force) await checkRecentCheckouts(now).catch((e) => console.error('[jobs] checkout check failed', e))

  // 3. Planning snapshot: tell ops tonight's plan is ready.
  const planDate = snapshotWindowDate(now, settings)
  if (planDate) {
    await once(`snapshot:${planDate}`, async () => {
      summary.planNotice = true
      return planReadyNotice(planDate, formatClock(settings.shiftStartMinutes))
    })
  }

  // 3b. Shortly before the shift: every driver working tonight is reminded to go online and accept their stops.
  const soon = reminderWindowDate(now, settings)
  if (soon) await once(`remind:${soon}`, () => preShiftReminder(soon, formatClock(settings.shiftStartMinutes)))

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

  // 6. Money, on the scheduler's runs only (they call Paystack): 7am settlements, yesterday's reconciliation and the
  //    Paystack top-up check; from 10am the daily driver payout (retried until the balance covers it).
  if (force) await moneyJobs(now, settings.timezone, settings.shiftStartMinutes)

  // 6b. In the morning: customers collected last night are asked if all went well (lib/customer-reports-server.ts),
  //     and on Mondays ops managers get last week's driver-check overrides (lib/overrides-server.ts).
  const today = localParts(now, settings.timezone)
  if (today.minutes >= CUSTOMER_CHECK_MINUTES && today.minutes < settings.shiftStartMinutes) {
    await once(`customer-check:${ended}`, () => customerCheckPrompt(ended))
    if (new Date(`${today.date}T12:00:00Z`).getUTCDay() === 1) await once(`overrides:${today.date}`, () => overridesDigest(now))
  }

  // 7. Once a day, delete personal data past its time (privacy policy section 6, lib/retention.ts).
  if (force && RETENTION_CLEANUP_ON) {
    await once(`retention:${localParts(now, settings.timezone).date}`, async () => retentionSummary(await runRetention(now, false)))
  }

  return summary
}

async function moneyJobs(now: Date, timezone: string, shiftStartMinutes: number) {
  const { date, minutes } = localParts(now, timezone)
  if (minutes >= RECONCILE_MINUTES) {
    await once(`settlements:${date}`, async () => `${await syncSettlements(now)} new settlement(s)`)
    const yesterday = addDays(date, -1)
    await once(`reconcile:${yesterday}`, async () => ((await reconcileDay(yesterday, timezone)).ok ? 'all checks match' : 'differences found'))
  }
  if (minutes >= TOPUP_CHECK_MINUTES) await once(`topup:${date}`, () => morningTopUpCheck(date))
  // The sweep runs in the day, before the night's shift starts.
  if (minutes >= SWEEP_MINUTES && minutes < shiftStartMinutes) {
    await once(`sweep:${date}`, async () => {
      const r = await runDailySweep()
      if (!r.done) throw new Error(`SWEEP_WAITING: ${r.summary}`) // releases the lock: tried again on the next run
      return r.summary
    })
  }
}

// The last REMIND_BEFORE_MINUTES before the shift starts: the date of tonight's shift.
function reminderWindowDate(now: Date, s: { timezone: string; shiftStartMinutes: number }): string | null {
  const { date, minutes } = localParts(now, s.timezone)
  return minutes >= s.shiftStartMinutes - REMIND_BEFORE_MINUTES && minutes < s.shiftStartMinutes ? date : null
}

// Approved, active drivers who work this night (their availability), with whether they are online.
async function workingDrivers(shiftDate: string) {
  const drivers = await prisma.driverProfile.findMany({
    where: { approvalStatus: 'APPROVED', isActive: true, user: { active: true } },
    select: { userId: true, isOnline: true, workNights: true, nightsOff: true },
  })
  return drivers.filter((d) => worksNight(d, shiftDate))
}

// Unaccepted stops per driver, right now.
async function unacceptedByDriver(): Promise<Map<string, number>> {
  const rows = await prisma.order.groupBy({
    by: ['driverId'],
    where: { status: 'ASSIGNED', driverAcceptedAt: null, driverId: { not: null } },
    _count: { _all: true },
  })
  return new Map((rows as { driverId: string; _count: { _all: number } }[]).map((r) => [r.driverId, r._count._all]))
}

async function preShiftReminder(shiftDate: string, startLabel: string): Promise<string> {
  const [drivers, waiting] = await Promise.all([workingDrivers(shiftDate), unacceptedByDriver()])
  let n = 0
  for (const d of drivers) {
    const stops = waiting.get(d.userId) ?? 0
    if (d.isOnline && stops === 0) continue
    const accept = stops > 0 ? ` Accept your ${count(stops, 'stop')} now so they stay yours.` : ''
    await notifyUser(d.userId, {
      title: `The shift starts at ${startLabel}`,
      body: `You're working tonight. Open Trashit and go online at ${startLabel} so stops near you come to you.${accept}`,
      url: '/dashboard/driver',
      sms: `Trashit: you're working tonight. Go online in the app at ${startLabel}.${stops > 0 ? ` You have ${count(stops, 'stop')} to accept.` : ''}`,
    })
    n++
  }
  return `${n} driver(s) reminded`
}

// Everyone online goes offline, except drivers with extra hours from ops that haven't run out.
async function switchEveryoneOffline(now: Date): Promise<number> {
  const r = await prisma.driverProfile.updateMany({
    where: { isOnline: true, OR: [{ onlineOverrideUntil: null }, { onlineOverrideUntil: { lte: now } }] },
    data: { isOnline: false, wentOnlineAt: null, currentLat: null, currentLng: null, lastLocationAt: null },
  })
  return r.count
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
    // A payout sweep waiting for the Paystack balance is expected, not a failure.
    if (!String(caught(e)?.message ?? '').startsWith('SWEEP_WAITING')) console.error(`[jobs] ${key} failed`, e)
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
      `${count(orders.length, 'order')}: ${placed} fit across ${count(plan.drivers.length, 'driver')}` +
      (plan.unassigned.length ? `, ${plan.unassigned.length} can't be placed yet` : '') +
      `. Review and approve on the Assign page before ${startLabel}.` +
      (auto ? ' Anything not approved is assigned automatically once the shift starts.' : ''),
    url: '/ops/assign',
  })
  return `${orders.length} orders, ${placed} placed, ${plan.unassigned.length} not placed`
}

async function shiftStartNotice(shiftDate: string, auto: boolean): Promise<string> {
  const [waiting, unaccepted, acceptMinutes, working] = await Promise.all([
    prisma.order.count({ where: { status: 'PAID', shiftDate: { lte: dbDate(shiftDate) } } }),
    unacceptedByDriver(),
    getAcceptMinutes(),
    workingDrivers(shiftDate),
  ])

  // Drivers with stops to accept, and every driver working tonight who isn't online yet.
  const remind = new Set<string>([...unaccepted.keys(), ...working.filter((d) => !d.isOnline).map((d) => d.userId)])
  for (const id of remind) {
    const stops = unaccepted.get(id) ?? 0
    await notifyUser(id, {
      title: 'The shift has started',
      body:
        stops > 0
          ? `Go online and accept your ${count(stops, 'stop')} within ${acceptMinutes} min, or they go to another driver.`
          : "You're working tonight. Go online now so stops near you come to you.",
      url: '/dashboard/driver',
      sms: stops > 0 ? `Trashit: the shift has started. Go online and accept your ${count(stops, 'stop')} within ${acceptMinutes} min.` : "Trashit: the shift has started. Go online in the app so stops near you come to you.",
    })
  }
  if (waiting > 0) {
    await notifyOps({
      title: 'Shift started with orders waiting',
      body: auto
        ? `${count(waiting, 'order has', 'orders have')} no driver yet. They'll be assigned automatically as drivers come online.`
        : `${count(waiting, 'order has', 'orders have')} no driver yet. Assign them on the Assign page.`,
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

  return `${waiting} waiting, ${remind.size} driver(s) reminded, ${customers.length} customer(s) reminded`
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
  let repeatedTotal = 0

  for (;;) {
    const batch = await prisma.order.findMany({
      where: { status: { in: ['PAID', 'ASSIGNED'] }, shiftDate: { lte: dbDate(endedShiftDate) } },
      select: { id: true, customerId: true, status: true, rolloverCount: true },
      take: 200,
    })
    if (batch.length === 0) break
    const ids = batch.map((o: { id: string }) => o.id)

    await prisma.$transaction(
      async (tx) => {
        // Stops still on a driver's list at shift end count as missed for that driver (their history and analytics).
        const missed = await tx.order.findMany({
          where: { id: { in: ids }, status: 'ASSIGNED', driverId: { not: null } },
          select: { id: true, driverId: true, shiftDate: true, driverAcceptedAt: true },
        })
        if (missed.length > 0) {
          await tx.driverMiss.createMany({
            data: missed.map((o: { id: string; driverId: string | null; shiftDate: Date | null; driverAcceptedAt: Date | null }) => ({
              driverId: o.driverId!,
              orderId: o.id,
              kind: 'NOT_COLLECTED',
              reason: o.driverAcceptedAt ? 'Accepted but not collected by shift end' : 'Not answered or collected by shift end',
              shiftDate: o.shiftDate,
            })),
          })
        }
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

    // Orders that have now missed REFUND_OFFER_ROLLOVERS nights or more: the customer is offered their money back.
    const repeated = batch.filter((o: { rolloverCount: number }) => o.rolloverCount + 1 >= REFUND_OFFER_ROLLOVERS)
    repeatedTotal += repeated.length
    const offerRefund = new Set(repeated.map((o: { customerId: string }) => o.customerId))
    const customers = Array.from(new Set(batch.map((o: { customerId: string }) => o.customerId)))
    for (const c of customers) {
      if (offerRefund.has(c)) {
        await notifyUser(c as string, {
          title: 'Sorry, we missed your pickup again',
          body: `We couldn't collect on ${nightName(endedShiftDate)} night either. Your pickup is booked for ${nightName(next)} night, or you can cancel it for a full refund on your order page before the shift starts.`,
          url: '/dashboard/customer/orders',
          sms: `Trashit: sorry, we missed your pickup again. It is booked for ${nightName(next)} night, or cancel it in the app for a full refund.`,
        })
        continue
      }
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
        (moved > 0 ? `${count(moved, "order wasn't", "orders weren't")} collected and moved to the night of ${dateLabel(`${next}T12:00:00Z`)}. ` : '') +
        (stillOnBoard > 0 ? `${count(stillOnBoard, "collected order hasn't", "collected orders haven't")} been confirmed as unloaded yet.` : ''),
      url: moved > 0 ? '/ops/assign' : '/ops/disposal-review',
    })
  }
  if (repeatedTotal > 0) {
    await notifyOps({
      title: `${count(repeatedTotal, 'order has', 'orders have')} missed ${REFUND_OFFER_ROLLOVERS}+ nights`,
      body: `${count(repeatedTotal, 'customer was', 'customers were')} offered a refund. Put these orders first on the Assign page tonight, or call the customers.`,
      url: '/ops/assign',
    })
  }
  return moved
}
