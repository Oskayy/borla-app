import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { computeQuote, parseOrderInput } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'quote', maxAttempts: 40, windowMinutes: 10 })) {
    return tooManyRequests()
  }

  const input = parseOrderInput(await readJson(req))
  if (!input) return NextResponse.json({ error: 'Invalid order details' }, { status: 400 })

  const quote = await computeQuote(input)
  if (!quote) return NextResponse.json({ error: 'No active pricing rule found' }, { status: 500 })

  return NextResponse.json(quote)
}