import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { getShiftSettings } from '@/lib/settings'
import { planningShiftDate } from '@/lib/schedule'
import { parseAvailability } from '@/lib/availability'

// The driver sets the nights they work each week and any single nights off.
// Dispatch leaves them out on nights they are off (lib/dispatch-server.ts). Stops already on their list stay.
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_availability', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const today = planningShiftDate(new Date(), await getShiftSettings())
  const parsed = parseAvailability(await readJson(req), today)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const updated = await prisma.driverProfile.updateMany({ where: { userId: auth.user.id }, data: parsed.value })
  if (updated.count === 0) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
  return NextResponse.json({ ok: true, ...parsed.value })
}
