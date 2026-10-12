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
  // Step 7: surcharge and discount sharing, and the distance bonus (missing = the defaults).
  const pct = (v: unknown, d: number) => (v === undefined || v === '' ? d : inRange(v, 0, 100))
  const late = pct(body?.lateSurchargeDriverPercent, 100)
  const hazard = pct(body?.hazardSurchargeDriverPercent, 100)
  const discount = pct(body?.recyclableDiscountPlatformPercent, 100)
  const freeKm = body?.distanceFreeKm === undefined ? 3 : inRange(body.distanceFreeKm, 0, 100)
  const perKm = body?.distanceBonusPerKm === undefined ? 1 : inRange(body.distanceBonusPerKm, 0, 50)
  const cap = body?.distanceBonusCap === undefined ? 10 : inRange(body.distanceBonusCap, 0, 500)
  if (late === null || hazard === null || discount === null) {
    return NextResponse.json({ error: 'Surcharge and discount shares must be between 0 and 100%' }, { status: 400 })
  }
  if (freeKm === null || perKm === null || cap === null) {
    return NextResponse.json({ error: 'Check the distance bonus: free distance 0-100 km, GHS 0-50 per km, cap GHS 0-500' }, { status: 400 })
  }

  const rule = await prisma.$transaction(async (tx) => {
    await tx.payoutRule.updateMany({ where: { active: true }, data: { active: false } })
    return tx.payoutRule.create({
      data: {
        pickupPercent: pickup,
        disposalPercent: disposal,
        lateSurchargeDriverPercent: late,
        hazardSurchargeDriverPercent: hazard,
        recyclableDiscountPlatformPercent: discount,
        distanceFreeKm: freeKm,
        distanceBonusPerKm: perKm,
        distanceBonusCap: cap,
        active: true,
      },
    })
  })

  await logAdminAction(auth.user.id, 'PAYOUT_RULE_ACTIVATED', rule.id, `Pickup ${pickup}% / disposal ${disposal}%; late surcharge ${late}% and hazardous ${hazard}% to drivers; Trashit absorbs ${discount}% of the recyclable discount; bonus GHS ${perKm}/km beyond ${freeKm} km, max GHS ${cap}`)

  return NextResponse.json({ success: true, rule })
}