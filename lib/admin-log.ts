import { prisma } from '@/lib/prisma'

// Records who changed what. A failure to log never blocks the action itself.
export async function logAdminAction(
  actorId: string,
  action: string,
  targetId: string | null,
  detail: string
) {
  try {
    await prisma.adminActionLog.create({
      data: { actorId, action, targetId, detail: detail.slice(0, 500) },
    })
  } catch (e) {
    console.error('[admin-log] failed to write:', e)
  }
}