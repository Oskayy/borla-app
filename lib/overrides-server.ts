// Driver checks that ops went past (radius, capacity, online, trips, shift time). Each override needs a reason, kept
// on the order's history; this lists them so an ops manager can see who overrides what, and how often.

import { prisma } from '@/lib/prisma'
import { notifyUsers } from '@/lib/notify'

export const OVERRIDE_MARKERS = ['[OVERRIDE:', '[OVER LIMIT:']

export interface OverrideRow {
  orderId: string
  at: string
  by: string
  detail: string // what was overridden and the reason given
}

export async function recentOverrides(days: number, now = new Date()): Promise<OverrideRow[]> {
  const since = new Date(now.getTime() - days * 86_400_000)
  const logs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: since }, OR: OVERRIDE_MARKERS.map((m) => ({ reason: { contains: m } })) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { orderId: true, createdAt: true, actorId: true, reason: true },
  })
  const actors = Array.from(new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x)))
  const names = new Map((await prisma.user.findMany({ where: { id: { in: actors } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
  return logs.map((l) => {
    const at = OVERRIDE_MARKERS.map((m) => l.reason?.indexOf(m) ?? -1).filter((i) => i >= 0)
    return {
      orderId: l.orderId,
      at: l.createdAt.toISOString(),
      by: (l.actorId && names.get(l.actorId)) || 'Unknown',
      detail: l.reason ? l.reason.slice(Math.min(...at)).replace(/^\[|\]$/g, '') : '',
    }
  })
}

// Monday morning: last week's overrides, to ops managers and super admins.
export async function overridesDigest(now: Date): Promise<string> {
  const rows = await recentOverrides(7, now)
  if (rows.length === 0) return 'no overrides'
  const byPerson = new Map<string, number>()
  for (const r of rows) byPerson.set(r.by, (byPerson.get(r.by) ?? 0) + 1)
  const people = Array.from(byPerson.entries()).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', ')
  const managers = await prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'OPS_MANAGER'] }, active: true }, select: { id: true } })
  await notifyUsers(
    managers.map((m) => m.id),
    {
      title: `${rows.length} driver-check override${rows.length === 1 ? '' : 's'} last week`,
      body: `By ${people}. See them with their reasons at the foot of the Assign page.`,
      url: '/ops/assign#overrides',
    }
  )
  return `${rows.length} override(s)`
}
