// A driver going offline mid-shift: stops still to collect go to other drivers, collected orders stay, ops are told.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const db = vi.hoisted(() => ({
  orders: [] as { id: string; driverId: string | null; status: string; shiftDate: Date | null; createdAt: Date }[],
  audit: [] as string[],
  declines: [] as string[],
}))
const reassign = vi.hoisted(() => vi.fn())
const notifyOps = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => {
  const where = (w: { driverId?: string; status?: string | { in: string[] }; id?: string }) => (o: (typeof db.orders)[number]) =>
    (w.id == null || o.id === w.id) &&
    (w.driverId == null || o.driverId === w.driverId) &&
    (w.status == null || (typeof w.status === 'string' ? o.status === w.status : w.status.in.includes(o.status)))
  const order = {
    findMany: async ({ where: w }: { where: Parameters<typeof where>[0] }) => db.orders.filter(where(w)),
    count: async ({ where: w }: { where: Parameters<typeof where>[0] }) => db.orders.filter(where(w)).length,
    updateMany: async ({ where: w, data }: { where: Parameters<typeof where>[0]; data: { driverId: null; status: string } }) => {
      const hit = db.orders.filter(where(w))
      hit.forEach((o) => Object.assign(o, { driverId: data.driverId, status: data.status }))
      return { count: hit.length }
    },
  }
  const tx = {
    order,
    routeStop: { deleteMany: async () => ({ count: 1 }) },
    orderDecline: { createMany: async ({ data }: { data: { orderId: string }[] }) => (db.declines.push(...data.map((d) => d.orderId)), { count: data.length }) },
    auditLog: { create: async ({ data }: { data: { orderId: string; reason: string } }) => db.audit.push(`${data.orderId}: ${data.reason}`) },
  }
  return { prisma: { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } }
})
vi.mock('@/lib/reassign-server', () => ({ reassignOrder: reassign }))
vi.mock('@/lib/notify', () => ({ notifyOps }))

import { openWork, releaseStopsOnOffline } from '@/lib/driver-offline-server'

const o = (id: string, status: string, driverId: string | null = 'd1') => ({ id, driverId, status, shiftDate: null, createdAt: new Date() })

beforeEach(() => {
  db.orders = [o('a', 'ASSIGNED'), o('b', 'ASSIGNED'), o('c', 'PICKED_UP'), o('x', 'ASSIGNED', 'd2')]
  db.audit = []
  db.declines = []
  reassign.mockReset()
  notifyOps.mockReset()
})

describe('going offline with stops', () => {
  it('counts what going offline would affect', async () => {
    expect(await openWork('d1')).toEqual({ toCollect: 2, onBoard: 1 })
  })

  it('releases stops still to collect, keeps collected ones, hands them on and tells ops', async () => {
    reassign.mockImplementation(async (id: string) => ({ reassigned: id === 'a' }))
    const r = await releaseStopsOnOffline('d1', 'Kwame Asante')
    expect(r).toEqual({ released: 2, reassigned: 1, onBoard: 1 })
    expect(db.orders.find((x) => x.id === 'a')).toMatchObject({ status: 'PAID', driverId: null })
    expect(db.orders.find((x) => x.id === 'c')).toMatchObject({ status: 'PICKED_UP', driverId: 'd1' }) // on board: stays
    expect(db.orders.find((x) => x.id === 'x')).toMatchObject({ status: 'ASSIGNED', driverId: 'd2' }) // another driver's
    expect(db.declines.sort()).toEqual(['a', 'b'])
    expect(db.audit).toEqual(['a: RELEASED: Went offline during the shift', 'b: RELEASED: Went offline during the shift'])
    expect(reassign).toHaveBeenCalledTimes(2)
    expect(notifyOps).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Kwame Asante went offline with 2 stops',
        body: '1 given to other drivers, 1 waiting for a driver on Plan & assign. 1 collected order is still on board, not yet unloaded.',
      })
    )
  })

  it('tells nobody when there was nothing to hand on', async () => {
    db.orders = []
    expect(await releaseStopsOnOffline('d1', 'Kwame')).toEqual({ released: 0, reassigned: 0, onBoard: 0 })
    expect(notifyOps).not.toHaveBeenCalled()
  })
})

describe('the Go offline route', () => {
  const src = readFileSync(path.resolve(__dirname, '../app/api/driver/online/route.ts'), 'utf8')
  it('asks the driver first, and only releases after they confirm', () => {
    const ask = src.indexOf('needsConfirm: true')
    const release = src.indexOf('releaseStopsOnOffline(')
    expect(ask).toBeGreaterThan(0)
    expect(release).toBeGreaterThan(ask)
    expect(src).toContain("body?.confirm === true")
  })
  it('switches the driver offline before handing stops on, so they are never offered back to them', () => {
    expect(src.indexOf('isOnline: false')).toBeLessThan(src.indexOf('releaseStopsOnOffline('))
  })
})
