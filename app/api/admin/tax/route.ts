import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { inRange } from '@/lib/numbers'
import { logAdminAction } from '@/lib/admin-log'

// Tax rates (lib/tax.ts): VAT and levies on prices, and withholding on driver payouts. All 0 until Trashit's
// accountant confirms them. New prices and payouts use them straight away; prices already paid keep theirs.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['SUPER_ADMIN', 'FINANCE'])
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'tax_change', maxAttempts: 10, windowMinutes: 60 })) return tooManyRequests()

  const body = await readJson(req)
  const vat = inRange(body?.vatPercent, 0, 50)
  const nhil = inRange(body?.nhilPercent, 0, 50)
  const getfund = inRange(body?.getfundPercent, 0, 50)
  const wht = inRange(body?.withholdingPercent, 0, 50)
  if (vat === null || nhil === null || getfund === null || wht === null) {
    return NextResponse.json({ error: 'Each rate must be a percentage from 0 to 50' }, { status: 400 })
  }
  const data = { vatPercent: vat, nhilPercent: nhil, getfundPercent: getfund, withholdingPercent: wht }
  await prisma.operatingSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })
  await logAdminAction(auth.user.id, 'TAX_RATES_CHANGED', null, `VAT ${vat}%, NHIL ${nhil}%, GETFund ${getfund}%, withholding on driver pay ${wht}%`)
  return NextResponse.json({ success: true })
}
