import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isUuid, readJson } from '@/lib/validate'
import { driverRouteVersion } from '@/lib/driver-updates'
import { runScheduledJobs } from '@/lib/nightly-jobs'

// The driver's screen asks this every few seconds: has my route changed, and are there new messages?
// Each check also runs the night's automatic jobs (at most once a minute), in case the scheduler isn't set up.
export async function GET() {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  try {
    await runScheduledJobs()
  } catch (e) {
    console.error('[updates] scheduled jobs failed', e)
  }

  const [version, alerts] = await Promise.all([
    driverRouteVersion(auth.user.id),
    prisma.notification.findMany({
      where: { userId: auth.user.id, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, body: true, createdAt: true },
    }),
  ])
  return NextResponse.json({ version, alerts })
}

// Marks messages as seen.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response
  const ids = (await readJson(req))?.ids
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every(isUuid)) {
    return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  }
  await prisma.notification.updateMany({ where: { id: { in: ids }, userId: auth.user.id, readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({ success: true })
}
