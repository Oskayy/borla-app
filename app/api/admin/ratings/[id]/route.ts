import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { EXCEPTION_ROLES } from '@/lib/exceptions'

// Ops mark a low rating as looked at, so it leaves the "to review" list.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(EXCEPTION_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'rating_review', maxAttempts: 200, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })

  const updated = await prisma.orderRating.updateMany({
    where: { id, reviewedAt: null },
    data: { reviewedAt: new Date(), reviewedBy: auth.user.id },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Already reviewed, or not found' }, { status: 409 })
  await logAdminAction(auth.user.id, 'rating_reviewed', id, 'Low rating reviewed')
  return NextResponse.json({ ok: true })
}
