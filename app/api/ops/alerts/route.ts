import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { OPS_ALERT_ROLES } from '@/lib/notify'
import { runScheduledJobs } from '@/lib/nightly-jobs'

// Ops screens ask this every 30 seconds for new messages (plan ready, order needs a driver, night finished).
// Each check also runs the night's automatic jobs (at most once a minute), in case the scheduler isn't set up.
export async function GET() {
  const auth = await requireAuth(OPS_ALERT_ROLES)
  if (!auth.ok) return auth.response

  try {
    await runScheduledJobs()
  } catch (e) {
    console.error('[ops-alerts] scheduled jobs failed', e)
  }

  const alerts = await prisma.notification.findMany({
    where: { userId: auth.user.id, readAt: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, body: true, url: true, createdAt: true },
  })
  return NextResponse.json({ alerts })
}
