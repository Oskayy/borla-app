import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, parseGps, readJson } from '@/lib/validate'
import { evidenceFileExists, isValidEvidencePath } from '@/lib/storage'
import { notifyOps, notifyUser } from '@/lib/notify'
import { caught } from '@/lib/errors'

const ISSUE_TYPES = ['LOCKED_GATE', 'SPILL_HAZARD']

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'report_issue', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  const issueType = body?.issueType
  const gps = parseGps(body)
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : ''
  const photoPath = body?.photoPath ? body.photoPath : null

  if (!isUuid(orderId) || !ISSUE_TYPES.includes(issueType) || !gps.ok) {
    return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  }
  if (photoPath !== null && !isValidEvidencePath(photoPath, orderId)) {
    return NextResponse.json({ error: 'Please take the photo again.' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.driverId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'ASSIGNED') {
    return NextResponse.json({ error: 'Order not eligible for issue reporting' }, { status: 400 })
  }

  if (photoPath !== null && !(await evidenceFileExists(photoPath))) {
    return NextResponse.json({ error: 'Photo upload not found. Please retake the photo and try again.' }, { status: 400 })
  }

  const newStatus = issueType === 'LOCKED_GATE' ? 'FAILED_PICKUP' : 'DISPUTED'

  try {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: orderId, driverId: user.id, status: 'ASSIGNED' },
        data: { status: newStatus },
      })
      if (moved.count !== 1) throw new Error('STATE_CHANGED')

      if (photoPath !== null) {
        await tx.orderEvidence.create({
          data: {
            orderId,
            type: 'driver_pickup',
            photoUrl: photoPath,
            gpsLat: gps.lat,
            gpsLng: gps.lng,
            capturedAt: new Date(),
          },
        })
      }

      if (newStatus === 'DISPUTED') {
        await tx.dispute.create({
          data: { orderId, raisedBy: user.id, reason: `${issueType}: ${note || 'No additional note'}` },
        })
      }

      await tx.auditLog.create({
        data: {
          orderId,
          actorId: user.id,
          fromState: 'ASSIGNED',
          toState: newStatus,
          reason: `Driver reported: ${issueType} — ${note || 'no note'}`,
        },
      })
    })
  } catch (err) {
    const e = caught(err)
    if (e?.message === 'STATE_CHANGED') {
      return NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 })
    }
    console.error('[report-issue] failed:', e)
    return NextResponse.json({ error: 'Could not submit the report. Please try again.' }, { status: 500 })
  }

  const address = (order.quoteSnapshot as { address?: string } | null)?.address ?? 'An order'
  if (issueType === 'LOCKED_GATE') {
    await notifyUser(order.customerId, {
      title: 'We couldn’t reach your bins',
      body: 'Our driver found the gate locked or the bins out of reach. Trashit will contact you about another try.',
      url: `/dashboard/customer/orders/${orderId}`,
      sms: 'Trashit: our driver couldn’t reach your bins tonight (gate locked or bins not out). We’ll contact you about another try.',
    })
  }
  await notifyOps({
    title: issueType === 'LOCKED_GATE' ? 'Pickup failed: gate locked' : 'Pickup problem: spill or hazard',
    body: `${address}${note ? `: ${note}` : ''}. See the Exceptions page.`,
    url: '/ops/exceptions',
  })

  return NextResponse.json({ success: true, status: newStatus })
}