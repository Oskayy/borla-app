import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { logAdminAction } from '@/lib/admin-log'

// Lets a driver work outside shift hours for a set number of hours (e.g. to clear a backlog).
// hours = 0 removes the override; if the driver is then outside the shift, they are switched offline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'online_override', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params // the driver's user id
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid driver' }, { status: 400 })

  const hours = inRange((await readJson(req))?.hours, 0, 12)
  if (hours === null) return NextResponse.json({ error: 'Hours must be between 0 and 12' }, { status: 400 })

  const driver = await prisma.user.findFirst({
    where: { id, role: 'DRIVER' },
    select: { name: true, driverProfile: { select: { id: true } } },
  })
  if (!driver?.driverProfile) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const until = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : null
  await prisma.driverProfile.update({ where: { userId: id }, data: { onlineOverrideUntil: until } })

  await logAdminAction(
    auth.user.id,
    hours > 0 ? 'DRIVER_OVERRIDE_GRANTED' : 'DRIVER_OVERRIDE_REMOVED',
    id,
    hours > 0 ? `"${driver.name}" may work outside shift hours until ${until!.toISOString()}` : `"${driver.name}" override removed`
  )

  return NextResponse.json({ success: true, onlineOverrideUntil: until })
}
