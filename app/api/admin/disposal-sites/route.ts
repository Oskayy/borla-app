import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { describeHours, parseSiteBody, SITE_EDIT_ROLES } from '@/lib/disposal-sites'

export async function GET() {
  const auth = await requireAuth([...OPS_ROLES, 'FINANCE'])
  if (!auth.ok) return auth.response

  const sites = await prisma.facility.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ sites })
}

// Adds a disposal site.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(SITE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'site_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const parsed = parseSiteBody(await readJson(req))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const d = parsed.data

  if (d.zoneId) {
    if (!isUuid(d.zoneId) || !(await prisma.zone.findUnique({ where: { id: d.zoneId } }))) {
      return NextResponse.json({ error: 'That zone does not exist' }, { status: 400 })
    }
  }

  const site = await prisma.facility.create({ data: d })
  await logAdminAction(
    auth.user.id,
    'DISPOSAL_SITE_CREATED',
    site.id,
    `"${d.name}" at ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}; ${describeHours(d)}; accepts ${d.acceptedWaste.join('/')}`
  )

  return NextResponse.json({ success: true, site })
}