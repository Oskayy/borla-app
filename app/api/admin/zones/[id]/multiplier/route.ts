import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { logAdminAction } from '@/lib/admin-log'

// A zone's multiplier is a price, so only Super Admin and Finance can change it, and every change is logged.
const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'pricing_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })

  const multiplier = inRange((await readJson(req))?.priceMultiplier, 0.5, 5)
  if (multiplier === null) {
    return NextResponse.json({ error: 'The multiplier must be between 0.5 and 5' }, { status: 400 })
  }

  const existing = await prisma.zone.findUnique({ where: { id }, select: { name: true, priceMultiplier: true } })
  if (!existing) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
  if (existing.priceMultiplier === multiplier) return NextResponse.json({ success: true, unchanged: true })

  const zone = await prisma.zone.update({ where: { id }, data: { priceMultiplier: multiplier } })

  await logAdminAction(
    auth.user.id,
    'ZONE_MULTIPLIER_CHANGED',
    id,
    `"${existing.name}": x${existing.priceMultiplier} -> x${multiplier}`
  )

  return NextResponse.json({ success: true, zone })
}
