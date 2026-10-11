import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { postJournal } from '@/lib/journal-server'
import { ACCOUNTS, openingBalanceLines } from '@/lib/accounts'

// Finance records what the Paystack balance or the bank already held when the ledger started (or when Paystack
// switched from test to live). Kept apart from top-ups (which come out of the bank) and from income.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(PAYOUT_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'finance_entry', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()

  const body = await readJson(req)
  const account = body?.account === 'bank' ? ACCOUNTS.bank : body?.account === 'paystack_balance' ? ACCOUNTS.paystackBalance : null
  const amount = Number(body?.amount)
  const note = cleanText(body?.note, 150)
  if (!account) return NextResponse.json({ error: 'Choose the Paystack balance or the bank' }, { status: 400 })
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return NextResponse.json({ error: 'Please enter the amount in GHS, with at most 2 decimal places' }, { status: 400 })
  }
  if (!note || note.length < 3) return NextResponse.json({ error: 'Please say what this is, e.g. "Paystack test balance when the ledger started"' }, { status: 400 })

  await prisma.$transaction((tx) =>
    postJournal(tx, {
      key: `opening-${account}-${crypto.randomUUID()}`,
      event: 'opening_balance',
      lines: openingBalanceLines(account, Math.round(amount * 100)),
      memo: note,
      createdBy: auth.user.id,
    })
  )
  await logAdminAction(auth.user.id, 'OPENING_BALANCE', null, `${account === ACCOUNTS.bank ? 'Bank' : 'Paystack balance'} GHS ${amount.toFixed(2)}: ${note}`)
  return NextResponse.json({ success: true })
}
