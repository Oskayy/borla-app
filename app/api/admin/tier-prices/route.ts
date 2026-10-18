import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { parseTierPrices } from '@/lib/tier-price'
import { saveTierPrices } from '@/lib/tier-price-server'

// Tier prices are prices: only Super Admin and Finance change them. Every zone that follows a changed tier takes the
// new multiplier for new bookings; orders already priced keep theirs.
const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function POST(req: NextRequest) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'pricing_change', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const prices = parseTierPrices(await readJson(req))
  if ('error' in prices) return NextResponse.json({ error: prices.error }, { status: 400 })

  try {
    const result = await saveTierPrices(auth.user.id, prices)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2034') return NextResponse.json({ error: 'Someone else changed prices at the same moment. Please save again.' }, { status: 409 })
    throw err
  }
}
