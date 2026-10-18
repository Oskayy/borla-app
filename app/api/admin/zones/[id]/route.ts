import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { parseZoneBody, ZONE_EDIT_ROLES } from '@/lib/zones'
import { saveZone } from '@/lib/zone-save-server'
import { storedBoundary } from '@/lib/zone-shape'
import { caught } from '@/lib/errors'

// Changes a zone. With ?dryRun=1, only checks it and says which customers would move.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(ZONE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_change', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })

  const body = await readJson(req)
  const input = parseZoneBody(body)
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })
  const current = await prisma.zone.findUnique({ where: { id }, select: { active: true } })
  if (!current) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
  const active = typeof body?.active === 'boolean' ? body.active : current.active
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  const result = await saveZone({ id, input, active, actorId: auth.user.id, dryRun })
  if (!result.ok) {
    return NextResponse.json({ error: result.error, overlaps: result.overlaps, moves: result.moves }, { status: result.error === 'Zone not found' ? 404 : 409 })
  }
  return NextResponse.json({ success: true, dryRun, zoneId: id, moves: result.moves })
}

// Deletes a zone nothing uses. Anything linked (customers, drivers, sites, orders) keeps it: switch it off instead.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(ZONE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_change', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })

  const [driverCount, customerCount, facilityCount, orderCount] = await prisma.$transaction([
    prisma.driverProfile.count({ where: { zoneId: id } }),
    prisma.customerProfile.count({ where: { zoneId: id } }),
    prisma.facility.count({ where: { zoneId: id } }),
    prisma.order.count({ where: { zoneId: id } }),
  ])

  if (driverCount > 0 || customerCount > 0 || facilityCount > 0 || orderCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${driverCount} driver(s), ${customerCount} customer(s), ${facilityCount} facility(ies) and ${orderCount} order(s) are linked to this zone. Deactivate the zone instead, so its order history and prices stay intact.` },
      { status: 400 }
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      const z = await tx.zone.delete({ where: { id } })
      const b = storedBoundary(z.boundary)
      await tx.adminActionLog.create({
        data: { actorId: auth.user.id, action: 'ZONE_DELETED', targetId: id, detail: JSON.stringify({ name: z.name, city: z.city, priceMultiplier: z.priceMultiplier, boundary: b }).slice(0, 60_000) },
      })
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    console.error('[zones] delete failed:', e)
    return NextResponse.json({ error: 'Could not delete the zone' }, { status: 500 })
  }
}
