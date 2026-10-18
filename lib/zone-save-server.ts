// Saving a zone: the overlap check, moving customers whose home is now in a different zone, and the audit log all
// happen in one Serializable transaction, so two people saving neighbouring zones at once can't create an overlap
// (Postgres refuses one of them, and it is asked to try again). A dry run reports the same without saving.
// Prices: a new zone follows its tier's price (lib/tier-price.ts). Changing the tier of a zone that follows it changes
// its price, which only a Super Admin may do from here (Ops Managers don't set prices); Finance can instead give the
// zone its own price first.

import { Prisma, type ZoneTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pickZone } from '@/lib/zone-match'
import { areaKm2, OVERLAP_TOLERANCE_KM2, overlapKm2, storedBoundary, type ZoneBoundary } from '@/lib/zone-shape'
import type { ZoneInput } from '@/lib/zones'
import { tierLabel, zoneMultiplierAfter } from '@/lib/tier-price'
import { getTierPrices } from '@/lib/tier-price-server'

type Tx = Prisma.TransactionClient

export interface ZoneSaveResult {
  ok: boolean
  error?: string
  overlaps: { id: string; name: string; km2: number }[]
  moves: { toThis: number; awayFromThis: number } // customers whose zone changes
  price?: { before: number | null; after: number; followsTier: boolean } // the zone's multiplier for new bookings
  status?: number // HTTP status when not ok (409 by default)
  zoneId?: string
}

const ZONE_FIELDS = { id: true, name: true, city: true, centerLat: true, centerLng: true, radiusKm: true, priceMultiplier: true, boundary: true, active: true } as const

// The other active zones an outline overlaps (shared borders don't count).
function overlapsWith(shape: ZoneBoundary, others: { id: string; name: string; boundary: unknown }[]) {
  const out: ZoneSaveResult['overlaps'] = []
  for (const z of others) {
    const b = storedBoundary(z.boundary)
    if (!b) continue
    const km2 = overlapKm2(shape, b)
    if (km2 > OVERLAP_TOLERANCE_KM2) out.push({ id: z.id, name: z.name, km2: Math.round(km2 * 100) / 100 })
  }
  return out
}

// Works out which customers move, given the zones as they would be after the save.
async function customerMoves(tx: Tx, zoneId: string, zonesAfter: Parameters<typeof pickZone>[0]) {
  const homes = await tx.customerProfile.findMany({ where: { homeLat: { not: null }, homeLng: { not: null } }, select: { id: true, zoneId: true, homeLat: true, homeLng: true } })
  const changes: { id: string; zoneId: string | null }[] = []
  for (const h of homes) {
    const next = pickZone(zonesAfter, h.homeLat!, h.homeLng!)?.id ?? null
    // Only customers this save affects: those moving into this zone, or out of it.
    if (next !== h.zoneId && (next === zoneId || h.zoneId === zoneId)) changes.push({ id: h.id, zoneId: next })
  }
  return {
    changes,
    toThis: changes.filter((c) => c.zoneId === zoneId).length,
    awayFromThis: changes.filter((c) => c.zoneId !== zoneId).length,
  }
}

function summary(z: { name: string; city: string; boundary: unknown; active: boolean; tier?: ZoneTier | null }) {
  const b = storedBoundary(z.boundary)
  return { name: z.name, city: z.city, active: z.active, tier: z.tier ?? null, corners: b ? b.coordinates[0].length - 1 : 0, km2: b ? Math.round(areaKm2(b) * 100) / 100 : null, boundary: b }
}

// Creates (id null) or changes a zone. `dryRun` checks and counts without saving anything.
export async function saveZone(args: { id: string | null; input: ZoneInput; active: boolean; actorId: string; actorRole: string; dryRun?: boolean }): Promise<ZoneSaveResult> {
  const { id, input, active, actorId, actorRole, dryRun } = args
  try {
    return await prisma.$transaction(
      async (tx) => {
        const before = id ? await tx.zone.findUnique({ where: { id }, select: { ...ZONE_FIELDS, tier: true, followsTier: true } }) : null
        if (id && !before) return { ok: false, error: 'Zone not found', overlaps: [], moves: { toThis: 0, awayFromThis: 0 } }

        const others = await tx.zone.findMany({ where: { active: true, ...(id ? { id: { not: id } } : {}) }, select: ZONE_FIELDS })
        // An inactive zone can overlap others (it matches no address); it is checked again when switched back on.
        const overlaps = active ? overlapsWith(input.boundary, others) : []
        const selfId = id ?? 'new-zone'
        const zonesAfter = [...others, ...(active ? [{ ...input, id: selfId, priceMultiplier: before?.priceMultiplier ?? 1, boundary: input.boundary }] : [])]
        const moves = await customerMoves(tx, selfId, zonesAfter)
        const tier = input.tier ?? before?.tier ?? 'STANDARD'
        const multiplier = zoneMultiplierAfter(before, tier, await getTierPrices(tx))
        const followsTier = before ? before.followsTier : true
        const price = { before: before?.priceMultiplier ?? null, after: multiplier, followsTier }
        const result: ZoneSaveResult = { ok: overlaps.length === 0, overlaps, moves: { toThis: moves.toThis, awayFromThis: moves.awayFromThis }, price }
        if (before && before.priceMultiplier !== multiplier && actorRole !== 'SUPER_ADMIN') {
          return {
            ...result,
            ok: false,
            status: 403,
            error: `Making this zone ${tierLabel(tier)} changes its price from ×${before.priceMultiplier} to ×${multiplier} for new bookings. Only a Super Admin can do that here, or Finance can give the zone its own price first.`,
          }
        }
        if (overlaps.length) {
          result.error = `This zone overlaps ${overlaps.map((o) => `${o.name} (${o.km2} km²)`).join(', ')}. Every address must be in one zone only: move its edge, or use Trim to fit.`
          return result
        }
        if (dryRun) return result

        const data = { ...input, boundary: input.boundary as unknown as Prisma.InputJsonValue, active, priceMultiplier: multiplier, ...(before ? {} : { followsTier: true }) }
        const saved = id ? await tx.zone.update({ where: { id }, data }) : await tx.zone.create({ data })
        for (const c of moves.changes) await tx.customerProfile.update({ where: { id: c.id }, data: { zoneId: c.zoneId === 'new-zone' ? saved.id : c.zoneId } })
        await tx.adminActionLog.create({
          data: {
            actorId,
            action: id ? 'ZONE_CHANGED' : 'ZONE_CREATED',
            targetId: saved.id,
            detail: JSON.stringify({ before: before ? summary(before) : null, after: summary({ ...saved, boundary: input.boundary }), price, customersMoved: moves.changes.length }).slice(0, 60_000),
          },
        })
        return { ...result, zoneId: saved.id }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 }
    )
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'P2034') return { ok: false, error: 'Someone else changed a zone at the same moment. Please save again.', overlaps: [], moves: { toThis: 0, awayFromThis: 0 } }
    throw err
  }
}
