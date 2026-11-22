import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { notifyUser } from '@/lib/notify'
import { NO_ZONE } from '@/lib/home-change'

// Approves or sends back an approved driver's move of home base / zone (lib/home-change.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'home_change', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params // the driver's user id
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid driver' }, { status: 400 })
  const body = await readJson(req)
  const approve = body?.approve
  const note = cleanText(body?.note, 300)
  if (typeof approve !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (!approve && (!note || note.length < 3)) return NextResponse.json({ error: 'Please say why, for the driver' }, { status: 400 })

  const p = await prisma.driverProfile.findUnique({
    where: { userId: id },
    select: { pendingHomeLat: true, pendingHomeLng: true, pendingHomeAddress: true, pendingZoneId: true, pendingHomeAt: true, user: { select: { name: true } } },
  })
  if (!p?.pendingHomeAt || p.pendingHomeLat == null || p.pendingHomeLng == null) {
    return NextResponse.json({ error: 'There is no home base move waiting. Please refresh.' }, { status: 409 })
  }

  const clear = { pendingHomeLat: null, pendingHomeLng: null, pendingHomeAddress: null, pendingZoneId: null, pendingHomeAt: null }
  if (approve) {
    const zoneId = p.pendingZoneId && p.pendingZoneId !== NO_ZONE ? p.pendingZoneId : null
    if (zoneId && !(await prisma.zone.findFirst({ where: { id: zoneId, active: true }, select: { id: true } }))) {
      return NextResponse.json({ error: 'The zone they chose is no longer active. Send it back.' }, { status: 409 })
    }
    await prisma.driverProfile.update({
      where: { userId: id },
      data: { ...clear, homeLat: p.pendingHomeLat, homeLng: p.pendingHomeLng, homeAddress: p.pendingHomeAddress, zoneId, homeChangeNote: null },
    })
  } else {
    await prisma.driverProfile.update({ where: { userId: id }, data: { ...clear, homeChangeNote: note } })
  }
  await logAdminAction(auth.user.id, approve ? 'HOME_CHANGE_APPROVED' : 'HOME_CHANGE_SENT_BACK', id, `"${p.user.name}"${note ? `: ${note}` : ''}`)
  await notifyUser(id, approve
    ? { title: 'New home base approved', body: 'Your stops are now planned from your new home base.', url: '/dashboard/driver/profile-setup' }
    : { title: 'Home base move sent back', body: note!, url: '/dashboard/driver/profile-setup' })
  return NextResponse.json({ success: true })
}
