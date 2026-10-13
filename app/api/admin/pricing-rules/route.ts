import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { logAdminAction } from '@/lib/admin-log'
import { MAX_ATTEMPT_FEE_PERCENT } from '@/lib/money-split'

const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET() {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  const rules = await prisma.pricingRule.findMany({
    orderBy: { createdAt: 'desc' },
    include: { binPrices: { include: { binSize: true } } },
  })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'pricing_change', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 80)
  const baseFee = inRange(body?.baseFee, 0, 1000)
  const perBinCharge = inRange(body?.volumeRate, 0, 1000)
  const hazardSurcharge = inRange(body?.hazardSurcharge, 0, 1000)
  const lateSurcharge = inRange(body?.lateSurcharge, 0, 1000)
  const platformFeePercent = inRange(body?.platformFeePercent, 0, 50)
  const discount = inRange(body?.separatedDiscountPercent, 0, 100)
  const attemptFeePercent = inRange(body?.attemptFeePercent ?? 0, 0, MAX_ATTEMPT_FEE_PERCENT)

  if (
    !name ||
    baseFee === null ||
    perBinCharge === null ||
    hazardSurcharge === null ||
    lateSurcharge === null ||
    platformFeePercent === null ||
    discount === null ||
    attemptFeePercent === null
  ) {
    return NextResponse.json({ error: 'Please check the pricing values (all fields are required)' }, { status: 400 })
  }

  // Every active bin size must get a fee, so every bin a customer can pick has a price.
  const sizes = await prisma.binSize.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } })
  const binFeesRaw = body?.binFees && typeof body.binFees === 'object' ? body.binFees : {}
  const binPrices: { binSizeId: string; fee: number }[] = []
  for (const size of sizes) {
    const fee = inRange(binFeesRaw[size.code], 0, 1000)
    if (fee === null) {
      return NextResponse.json({ error: `Please enter a fee for the ${size.label.toLowerCase()}` }, { status: 400 })
    }
    binPrices.push({ binSizeId: size.id, fee })
  }
  if (binPrices.length === 0) {
    return NextResponse.json({ error: 'No bin sizes are set up yet' }, { status: 400 })
  }

  const rule = await prisma.$transaction(async (tx) => {
    await tx.pricingRule.updateMany({ where: { active: true }, data: { active: false } })
    return tx.pricingRule.create({
      data: {
        name,
        baseFee,
        volumeRate: perBinCharge,
        zoneMultiplier: 1, // multipliers now live on each zone
        hazardSurcharge,
        lateSurcharge,
        platformFeePercent,
        separatedDiscountPercent: discount,
        attemptFeePercent,
        active: true,
        binPrices: { create: binPrices },
      },
    })
  })

  const binText = sizes.map((s, i) => `${s.code} ${binPrices[i].fee}`).join(', ')
  await logAdminAction(
    auth.user.id,
    'PRICING_RULE_ACTIVATED',
    rule.id,
    `"${name}": base ${baseFee}, bins [${binText}], per-bin ${perBinCharge}, hazard ${hazardSurcharge}, late ${lateSurcharge}, platform fee ${platformFeePercent}%, recyclable discount ${discount}%, attempt fee ${attemptFeePercent}%`
  )

  return NextResponse.json({ success: true, rule })
}
