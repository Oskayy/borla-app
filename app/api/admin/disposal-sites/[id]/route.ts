import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { describeHours, parseSiteBody, SITE_EDIT_ROLES } from '@/lib/disposal-sites'

// Edits a disposal site's details (position, geofence, hours, waste types, unload time).
// Sites are never deleted, because disposal records point at them; switch "active" off instead.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(SITE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'site_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid site' }, { status: 400 })

  const parsed = parseSiteBody(await readJson(req))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const d = parsed.data

  if (d.zoneId) {
    if (!isUuid(d.zoneId) || !(await prisma.zone.findUnique({ where: { id: d.zoneId } }))) {
      return NextResponse.json({ error: 'That zone does not exist' }, { status: 400 })
    }
  }

  const existing = await prisma.facility.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const site = await prisma.facility.update({ where: { id }, data: d })

  const moved =
    existing.lat == null || existing.lng == null
      ? 'placed on map'
      : existing.lat !== d.lat || existing.lng !== d.lng
      ? `moved to ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`
      : 'same position'
  await logAdminAction(
    auth.user.id,
    'DISPOSAL_SITE_UPDATED',
    id,
    `"${existing.name}" -> "${d.name}": ${moved}; geofence ${d.geofenceRadiusM} m; ${describeHours(d)}; accepts ${d.acceptedWaste.join('/')}; unload ${d.avgUnloadMinutes} min; active ${d.active}`
  )

  return NextResponse.json({ success: true, site })
}