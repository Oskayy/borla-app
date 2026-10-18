import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { ZONE_EDIT_ROLES } from '@/lib/zones'
import { areaKm2, isShapeError, parseBoundary } from '@/lib/zone-shape'
import { MAX_SCAN_KM2 } from '@/lib/zone-suggest'
import { suggestZones } from '@/lib/zone-suggest-server'

// OpenStreetMap's free service can take a minute or more to answer.
export const maxDuration = 120

// Suggests zone outlines and tiers for an area drawn on the map. Saves nothing: each suggestion is reviewed and
// saved through the normal zone form, with all its checks.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(ZONE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  // Each scan calls OpenStreetMap's free service: keep it occasional.
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_suggest', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const scan = parseBoundary(body?.area)
  if (isShapeError(scan)) return NextResponse.json({ error: scan.error }, { status: 400 })
  if (areaKm2(scan) > MAX_SCAN_KM2) return NextResponse.json({ error: `Scan at most ${MAX_SCAN_KM2} km² at a time. Draw a smaller area.` }, { status: 400 })
  const target = typeof body?.targetKm2 === 'number' && Number.isFinite(body.targetKm2) ? Math.min(Math.max(body.targetKm2, 1), 30) : 5

  const result = await suggestZones(scan, target)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
