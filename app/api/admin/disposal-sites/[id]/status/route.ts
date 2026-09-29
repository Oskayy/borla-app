import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { SITE_STATUS_ROLES, SITE_STATUSES } from '@/lib/disposal-sites'

// Quick status switch for use during a shift: OPEN, CLOSED or FULL (queueing / not accepting).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(SITE_STATUS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'site_status', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid site' }, { status: 400 })

  const status = (await readJson(req))?.status
  if (typeof status !== 'string' || !(SITE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const existing = await prisma.facility.findUnique({ where: { id }, select: { name: true, status: true } })
  if (!existing) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  if (existing.status === status) return NextResponse.json({ success: true, unchanged: true })

  await prisma.facility.update({ where: { id }, data: { status } })
  await logAdminAction(auth.user.id, 'DISPOSAL_SITE_STATUS', id, `"${existing.name}": ${existing.status} -> ${status}`)

  return NextResponse.json({ success: true })
}