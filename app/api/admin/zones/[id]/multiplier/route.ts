import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { Prisma } from '@prisma/client'
import { MULTIPLIER_MAX, MULTIPLIER_MIN, parseOwnMultiplier, tierLabel } from '@/lib/tier-price'
import { getTierPrices } from '@/lib/tier-price-server'

// A zone's multiplier is a price, so only Super Admin and Finance can change it, and every change is logged. A zone
// either has its own multiplier or follows its tier's (set on the Pricing page).
const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'pricing_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid zone' }, { status: 400 })

  // Either { priceMultiplier } (the zone's own price) or { followTier: true } (take its tier's price).
  const body = await readJson(req)
  const followTier = body?.followTier === true
  const own = followTier ? null : parseOwnMultiplier(body?.priceMultiplier)
  if (!followTier && own === null) {
    return NextResponse.json({ error: `The multiplier must be between ${MULTIPLIER_MIN} and ${MULTIPLIER_MAX}` }, { status: 400 })
  }

  const result = await prisma
    .$transaction(
    async (tx) => {
      const existing = await tx.zone.findUnique({ where: { id }, select: { name: true, tier: true, priceMultiplier: true, followsTier: true } })
      if (!existing) return null
      const multiplier = followTier ? (await getTierPrices(tx))[existing.tier] : own!
      if (existing.priceMultiplier === multiplier && existing.followsTier === followTier) return { unchanged: true, multiplier }
      await tx.zone.update({ where: { id }, data: { priceMultiplier: multiplier, followsTier: followTier } })
      const how = (f: boolean) => (f ? `follows ${tierLabel(existing.tier)}` : 'own price')
      await tx.adminActionLog.create({
        data: {
          actorId: auth.user.id,
          action: 'ZONE_MULTIPLIER_CHANGED',
          targetId: id,
          detail: `"${existing.name}": x${existing.priceMultiplier} (${how(existing.followsTier)}) -> x${multiplier} (${how(followTier)})`.slice(0, 500),
        },
      })
      return { unchanged: false, multiplier }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
    .catch((err) => {
      // Someone changed the tier prices or this zone at the same moment: ask to save again rather than fail.
      if ((err as { code?: string })?.code === 'P2034') return 'conflict' as const
      throw err
    })
  if (result === 'conflict') return NextResponse.json({ error: 'Someone else changed prices at the same moment. Please save again.' }, { status: 409 })
  if (!result) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
  return NextResponse.json({ success: true, ...result, followsTier: followTier })
}
