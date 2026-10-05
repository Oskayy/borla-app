import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { receiptNumber } from '@/lib/receipt-pdf'
import { monthKey, monthRange, parseMonth, statementCsv, type StatementData } from '@/lib/statement'
import { buildStatementPdf } from '@/lib/statement-pdf'

const WITHDRAWAL_STATUS: Record<string, string> = {
  REQUESTED: 'Waiting for approval',
  PROCESSING: 'Being sent',
  CONFIRMING: 'Being sent',
  PAID: 'Sent',
  FAILED: 'Failed',
  REJECTED: 'Not approved',
}

// The signed-in driver's earnings statement for one month: ?month=2026-10&format=pdf|csv
export async function GET(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_statement', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const month = parseMonth(req.nextUrl.searchParams.get('month'))
  if (!month) return NextResponse.json({ error: 'Choose a month, e.g. 2026-10' }, { status: 400 })
  const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'pdf'
  const { from, to } = monthRange(month)

  const [user, earnings, withdrawals] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true } }),
    prisma.ledgerEntry.findMany({
      where: { driverId: auth.user.id, type: { in: ['driver_payout_pickup', 'driver_payout_disposal'] }, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      select: { type: true, amount: true, createdAt: true, orderId: true, order: { select: { quoteSnapshot: true } } },
    }),
    prisma.withdrawal.findMany({
      where: { driverId: auth.user.id, requestedAt: { gte: from, lt: to } },
      orderBy: { requestedAt: 'asc' },
      select: { amount: true, status: true, requestedAt: true, reference: true, momoProvider: true, momoNumber: true },
    }),
  ])

  const data: StatementData = {
    driverName: user?.name ?? 'Driver',
    month,
    earnings: earnings.map((e) => ({
      date: e.createdAt,
      orderRef: receiptNumber(e.orderId),
      address: (e.order?.quoteSnapshot as { address?: string } | null)?.address ?? '',
      kind: e.type === 'driver_payout_pickup' ? 'pickup' : 'unload',
      amount: e.amount,
    })),
    withdrawals: withdrawals.map((w) => ({
      date: w.requestedAt,
      reference: w.reference,
      wallet: `${w.momoProvider} ${w.momoNumber}`,
      status: WITHDRAWAL_STATUS[w.status] ?? w.status,
      amount: w.amount,
    })),
  }

  const name = `trashit-earnings-${monthKey(month)}`
  if (format === 'csv') {
    return new NextResponse(statementCsv(data), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }
  const bytes = await buildStatementPdf(data)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
