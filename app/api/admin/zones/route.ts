import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { parseZoneBody, ZONE_EDIT_ROLES } from '@/lib/zones'
import { saveZone } from '@/lib/zone-save-server'

export async function GET() {
  const auth = await requireAuth([...OPS_ROLES, 'FINANCE'])
  if (!auth.ok) return auth.response

  const zones = await prisma.zone.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ zones })
}

// Creates a zone. With ?dryRun=1, only checks it and says which customers would move.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(ZONE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_change', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const input = parseZoneBody(body)
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  const result = await saveZone({ id: null, input, active: body?.active !== false, actorId: auth.user.id, dryRun })
  if (!result.ok) return NextResponse.json({ error: result.error, overlaps: result.overlaps, moves: result.moves }, { status: 409 })
  return NextResponse.json({ success: true, dryRun, zoneId: result.zoneId ?? null, moves: result.moves })
}
