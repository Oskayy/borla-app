// Reading and saving tier prices. Saving updates every zone that follows a changed tier in the same Serializable
// transaction and logs it, so the zones and the tier prices never disagree.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEFAULT_TIER_PRICES, TIER_LIST, type TierPrices } from '@/lib/tier-price'

type Db = Prisma.TransactionClient | typeof prisma

export async function getTierPrices(db: Db = prisma): Promise<TierPrices> {
  const rows = await db.tierPrice.findMany()
  const out = { ...DEFAULT_TIER_PRICES }
  for (const r of rows) out[r.tier] = r.multiplier
  return out
}

export async function saveTierPrices(actorId: string, next: TierPrices): Promise<{ changed: number; zonesUpdated: number }> {
  return prisma.$transaction(
    async (tx) => {
      const before = await getTierPrices(tx)
      let changed = 0
      let zonesUpdated = 0
      const changes: Record<string, { from: number; to: number; zones: number }> = {}
      for (const t of TIER_LIST) {
        if (before[t] === next[t]) continue
        await tx.tierPrice.upsert({ where: { tier: t }, create: { tier: t, multiplier: next[t] }, update: { multiplier: next[t] } })
        const z = await tx.zone.updateMany({ where: { tier: t, followsTier: true }, data: { priceMultiplier: next[t] } })
        changed++
        zonesUpdated += z.count
        changes[t] = { from: before[t], to: next[t], zones: z.count }
      }
      if (changed) {
        await tx.adminActionLog.create({ data: { actorId, action: 'TIER_PRICES_CHANGED', targetId: null, detail: JSON.stringify(changes) } })
      }
      return { changed, zonesUpdated }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
