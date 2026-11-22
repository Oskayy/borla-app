import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { notifyUser } from '@/lib/notify'

// Pauses a driver (no new stops, can't go online) or resumes them, e.g. after the automatic pause for accepted stops
// not collected (lib/driver-misses-server.ts). Stops they already have stay with them. A note is required.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_pause', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params // the driver's user id
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid driver' }, { status: 400 })
  const body = await readJson(req)
  const paused = body?.paused
  const note = cleanText(body?.note, 300)
  if (typeof paused !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (!note || note.length < 3) return NextResponse.json({ error: 'Please add a short note' }, { status: 400 })

  const driver = await prisma.user.findFirst({ where: { id, role: 'DRIVER' }, select: { name: true, driverProfile: { select: { isActive: true } } } })
  if (!driver?.driverProfile) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  await prisma.driverProfile.update({
    where: { userId: id },
    data: paused ? { isActive: false, isOnline: false, wentOnlineAt: null, currentLat: null, currentLng: null, lastLocationAt: null } : { isActive: true },
  })
  await logAdminAction(auth.user.id, paused ? 'DRIVER_PAUSED' : 'DRIVER_RESUMED', id, `"${driver.name}": ${note}`)
  await notifyUser(id, paused
    ? { title: 'Your account is paused', body: `Trashit paused your account: ${note}`, url: '/dashboard/driver' }
    : { title: 'You can work again', body: 'Trashit resumed your account. Go online when the shift starts.', url: '/dashboard/driver' })
  return NextResponse.json({ success: true, paused })
}
