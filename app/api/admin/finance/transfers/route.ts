import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'

// Finance switches Paystack transfers for driver payouts on (once the Paystack account can make transfers) or off.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(PAYOUT_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'finance_entry', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()
  const enabled = (await readJson(req))?.enabled
  if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'Choose on or off' }, { status: 400 })
  await prisma.operatingSettings.upsert({ where: { id: 1 }, create: { id: 1, paystackTransfers: enabled }, update: { paystackTransfers: enabled } })
  await logAdminAction(auth.user.id, 'PAYSTACK_TRANSFERS', null, enabled ? 'Switched on' : 'Switched off')
  return NextResponse.json({ success: true, enabled })
}
