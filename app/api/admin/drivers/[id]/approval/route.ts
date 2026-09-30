import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { APPROVAL_ROLES } from '@/lib/driver-docs'
import { notifyUser } from '@/lib/notify'

// Approve or reject a driver. Rejection needs a note, which the driver sees so they can fix and resend.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(APPROVAL_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_approval', maxAttempts: 100, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid driver' }, { status: 400 })
  const body = await readJson(req)
  const decision = body?.decision
  const note = cleanText(body?.note, 300)
  if (decision !== 'approve' && decision !== 'reject') return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  if (decision === 'reject' && (!note || note.length < 3)) {
    return NextResponse.json({ error: 'Please tell the driver what to fix' }, { status: 400 })
  }

  const profile = await prisma.driverProfile.findUnique({ where: { userId: id }, select: { approvalStatus: true } })
  if (!profile) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const approved = decision === 'approve'
  await prisma.driverProfile.update({
    where: { userId: id },
    data: {
      approvalStatus: approved ? 'APPROVED' : 'REJECTED',
      approvalNote: approved ? null : note,
      reviewedAt: new Date(),
      reviewedBy: auth.user.id,
      // A rejected driver can't be online or planned.
      ...(approved ? {} : { isOnline: false }),
    },
  })
  await logAdminAction(auth.user.id, approved ? 'DRIVER_APPROVED' : 'DRIVER_REJECTED', id, note ?? '')
  await notifyUser(id, approved
    ? {
        title: 'You’re approved!',
        body: 'Welcome to Borla. You can go online when the shift starts and receive pickups.',
        url: '/dashboard/driver',
        sms: 'Borla: your driver account is approved. Open the Borla app and go online when the shift starts.',
      }
    : {
        title: 'Please update your documents',
        body: `Your documents weren't approved yet: ${note}. Please fix this and send them again.`,
        url: '/dashboard/driver/verification',
        sms: `Borla: please update your driver documents: ${note}`,
      })
  return NextResponse.json({ success: true })
}
