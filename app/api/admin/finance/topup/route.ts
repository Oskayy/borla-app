import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { postJournal } from '@/lib/journal-server'
import { topUpLines } from '@/lib/accounts'

// Finance records money moved from the bank to the Paystack balance (to pay drivers), so the ledger and the
// daily balance check know about it.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(PAYOUT_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'finance_entry', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()

  const body = await readJson(req)
  const amount = Number(body?.amount)
  const reference = cleanText(body?.reference, 100)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return NextResponse.json({ error: 'Please enter the amount in GHS, with at most 2 decimal places' }, { status: 400 })
  }
  if (!reference || reference.length < 3) return NextResponse.json({ error: 'Please enter the bank or Paystack reference' }, { status: 400 })

  const pesewas = Math.round(amount * 100)
  await prisma.$transaction((tx) =>
    postJournal(tx, { key: `topup-${crypto.randomUUID()}`, event: 'top_up', lines: topUpLines(pesewas), memo: reference, createdBy: auth.user.id })
  )
  await logAdminAction(auth.user.id, 'PAYSTACK_TOP_UP', null, `GHS ${amount.toFixed(2)}, reference ${reference}`)
  return NextResponse.json({ success: true })
}
