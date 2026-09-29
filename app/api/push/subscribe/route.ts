import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'

// Saves (or removes) this phone's permission to receive push alerts.
function parse(body: any): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000) return null
  if (typeof p256dh !== 'string' || p256dh.length > 200 || typeof auth !== 'string' || auth.length > 100) return null
  return { endpoint, p256dh, auth }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session.ok) return session.response

  if (await enforceRateLimit({ identifier: session.user.id, action: 'push_subscribe', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const sub = parse(await readJson(req))
  if (!sub) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  // One phone = one endpoint. If someone else signs in on this phone, the alerts follow the new user.
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: session.user.id, ...sub },
    update: { userId: session.user.id, p256dh: sub.p256dh, auth: sub.auth },
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth()
  if (!session.ok) return session.response
  const endpoint = (await readJson(req))?.endpoint
  if (typeof endpoint !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
