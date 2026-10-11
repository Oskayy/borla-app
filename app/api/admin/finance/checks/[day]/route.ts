import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { cleanText, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'

// Finance marks a daily money check that found differences as looked at, with what they found.
export async function POST(req: NextRequest, { params }: { params: Promise<{ day: string }> }) {
  const auth = await requireAuth(PAYOUT_ROLES)
  if (!auth.ok) return auth.response
  const { day } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: 'Check not found' }, { status: 404 })
  const note = cleanText((await readJson(req))?.note, 300)
  if (!note || note.length < 3) return NextResponse.json({ error: 'Please say what you found' }, { status: 400 })
  const done = await prisma.reconciliationRun.updateMany({
    where: { day, reviewedAt: null },
    data: { reviewedAt: new Date(), reviewedBy: auth.user.id, reviewNote: note },
  })
  if (done.count !== 1) return NextResponse.json({ error: 'Already reviewed. Refresh the page.' }, { status: 409 })
  await logAdminAction(auth.user.id, 'MONEY_CHECK_REVIEWED', null, `${day}: ${note}`)
  return NextResponse.json({ success: true })
}
