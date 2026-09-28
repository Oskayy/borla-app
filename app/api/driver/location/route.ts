import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isValidLat, isValidLng, readJson } from '@/lib/validate'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_location', maxAttempts: 200, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  if (!isValidLat(body?.lat) || !isValidLng(body?.lng)) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
  }

  const updated = await prisma.driverProfile.updateMany({
    where: { userId: auth.user.id },
    data: { currentLat: body.lat, currentLng: body.lng, lastLocationAt: new Date() },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}