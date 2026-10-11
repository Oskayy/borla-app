import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { postJournal } from '@/lib/journal-server'
import { settlementLines } from '@/lib/accounts'

// Finance confirms a Paystack settlement reached the bank, with the amount that actually arrived. Any difference
// from what Paystack said it sent is kept in the ledger as a difference to explain.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(PAYOUT_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'finance_entry', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
  const received = Number((await readJson(req))?.received)
  if (!Number.isFinite(received) || received < 0 || Math.abs(received * 100 - Math.round(received * 100)) > 1e-6) {
    return NextResponse.json({ error: 'Please enter the amount that arrived, in GHS' }, { status: 400 })
  }
  const receivedPesewas = Math.round(received * 100)

  const s = await prisma.$transaction(async (tx) => {
    const claimed = await tx.paystackSettlement.updateMany({
      where: { id, confirmedAt: null },
      data: { confirmedAt: new Date(), confirmedBy: auth.user.id, receivedPesewas },
    })
    if (claimed.count !== 1) return null
    const row = await tx.paystackSettlement.findUniqueOrThrow({ where: { id } })
    await postJournal(tx, {
      key: `settlement-${row.paystackId}`,
      event: 'settlement',
      lines: settlementLines(row.amountPesewas, receivedPesewas),
      memo: `Paystack settlement ${row.paystackId}`,
      createdBy: auth.user.id,
    })
    return row
  })
  if (!s) return NextResponse.json({ error: 'This settlement was already confirmed. Refresh the page.' }, { status: 409 })
  const diff = receivedPesewas - s.amountPesewas
  await logAdminAction(
    auth.user.id,
    'SETTLEMENT_CONFIRMED',
    null,
    `Paystack ${s.paystackId}: expected GHS ${(s.amountPesewas / 100).toFixed(2)}, received GHS ${received.toFixed(2)}${diff ? ` (difference GHS ${(diff / 100).toFixed(2)})` : ''}`
  )
  return NextResponse.json({ success: true, difference: diff / 100 })
}
