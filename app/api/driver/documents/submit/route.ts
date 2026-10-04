import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { missingDocs, APPROVAL_ROLES } from '@/lib/driver-docs'
import { notifyUsers } from '@/lib/notify'

// The driver sends their documents for review.
export async function POST() {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  const profile = await prisma.driverProfile.findUnique({ where: { userId: auth.user.id }, select: { approvalStatus: true } })
  if (!profile) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
  if (profile.approvalStatus === 'APPROVED') return NextResponse.json({ success: true })

  const docs = await prisma.driverDocument.findMany({ where: { driverId: auth.user.id }, select: { type: true } })
  const missing = missingDocs(docs.map((d: { type: string }) => d.type))
  if (missing.length > 0) return NextResponse.json({ error: `Please add: ${missing.join(', ')}` }, { status: 400 })

  await prisma.driverProfile.update({
    where: { userId: auth.user.id },
    data: { approvalStatus: 'PENDING', submittedAt: new Date(), approvalNote: null },
  })

  const staff = await prisma.user.findMany({ where: { role: { in: APPROVAL_ROLES }, active: true }, select: { id: true } })
  await notifyUsers(
    staff.map((s: { id: string }) => s.id),
    { title: 'Driver waiting for approval', body: 'A new driver sent their documents. Review them on the Driver Approvals page.', url: '/ops/driver-approvals' }
  )
  return NextResponse.json({ success: true })
}
