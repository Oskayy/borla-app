import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isUuid, readJson } from '@/lib/validate'

// Marks the signed-in user's messages as seen.
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const ids = (await readJson(req))?.ids
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every(isUuid)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  await prisma.notification.updateMany({ where: { id: { in: ids }, userId: auth.user.id, readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({ success: true })
}
