import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { logAdminAction } from '@/lib/admin-log'

const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET() {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  const rules = await prisma.payoutRule.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'payout_change', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const pickup = inRange(body?.pickupPercent, 0, 100)
  const disposal = inRange(body?.disposalPercent, 0, 100)

  if (pickup === null || disposal === null || Math.abs(pickup + disposal - 100) > 0.001) {
    return NextResponse.json({ error: 'Pickup % and disposal % must add up to 100' }, { status: 400 })
  }

  const rule = await prisma.$transaction(async (tx) => {
    await tx.payoutRule.updateMany({ where: { active: true }, data: { active: false } })
    return tx.payoutRule.create({
      data: { pickupPercent: pickup, disposalPercent: disposal, active: true },
    })
  })

  await logAdminAction(auth.user.id, 'PAYOUT_RULE_ACTIVATED', rule.id, `Pickup ${pickup}% / disposal ${disposal}%`)

  return NextResponse.json({ success: true, rule })
}