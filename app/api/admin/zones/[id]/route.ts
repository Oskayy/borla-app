import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { parseZoneBody } from '@/lib/zones'
import { caught } from '@/lib/errors'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })

  const body = await readJson(req)
  const data = parseZoneBody(body)
  if (!data) return NextResponse.json({ error: 'Please check the zone details' }, { status: 400 })

  const active = typeof body?.active === 'boolean' ? body.active : undefined

  try {
    const zone = await prisma.zone.update({
      where: { id },
      data: { ...data, ...(active !== undefined ? { active } : {}) },
    })
    return NextResponse.json({ success: true, zone })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    console.error('[zones] update failed:', e)
    return NextResponse.json({ error: 'Could not update the zone' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })

  const driverCount = await prisma.driverProfile.count({ where: { zoneId: id } })
  const customerCount = await prisma.customerProfile.count({ where: { zoneId: id } })
  const facilityCount = await prisma.facility.count({ where: { zoneId: id } })
  const orderCount = await prisma.order.count({ where: { zoneId: id } })

  if (driverCount > 0 || customerCount > 0 || facilityCount > 0 || orderCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${driverCount} driver(s), ${customerCount} customer(s), ${facilityCount} facility(ies) and ${orderCount} order(s) are linked to this zone. Deactivate the zone instead, so its order history and prices stay intact.` },
      { status: 400 }
    )
  }

  try {
    await prisma.zone.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    const e = caught(err)
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    console.error('[zones] delete failed:', e)
    return NextResponse.json({ error: 'Could not delete the zone' }, { status: 500 })
  }
}