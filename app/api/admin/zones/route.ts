import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, OPS_ROLES } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { parseZoneBody } from '@/lib/zones'

export async function GET() {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  const zones = await prisma.zone.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ zones })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(OPS_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'zone_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const data = parseZoneBody(await readJson(req))
  if (!data) return NextResponse.json({ error: 'Please check the zone details' }, { status: 400 })

  const zone = await prisma.zone.create({ data })
  return NextResponse.json({ success: true, zone })
}