import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { OPEN_WITHDRAWAL_STATUSES } from '@/lib/wallet'
import { redirect } from 'next/navigation'
import { PAYOUT_ROLES, getWalletSummary } from '@/lib/wallet-server'
import WithdrawalsClient, { type WithdrawalRow } from '@/components/WithdrawalsClient'
import { PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function WithdrawalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !PAYOUT_ROLES.includes(dbUser.role)) redirect('/ops')

  const [open, recent] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { status: { in: OPEN_WITHDRAWAL_STATUSES } },
      orderBy: { requestedAt: 'asc' },
      include: { driver: { select: { name: true, phone: true } } },
    }),
    prisma.withdrawal.findMany({
      where: { status: { in: ['PAID', 'FAILED', 'REJECTED'] } },
      orderBy: { requestedAt: 'desc' },
      take: 30,
      include: { driver: { select: { name: true, phone: true } } },
    }),
  ])

  // Each waiting driver's balance, as a sense check before paying.
  const balances = new Map<string, number>()
  for (const w of open) {
    if (!balances.has(w.driverId)) balances.set(w.driverId, (await getWalletSummary(w.driverId)).earned)
  }

  const toRow = (w: (typeof open)[number]): WithdrawalRow => ({
    id: w.id,
    driverName: w.driver?.name ?? 'Driver',
    driverPhone: w.driver?.phone ?? '',
    amount: w.amount,
    status: w.status,
    momo: `${w.momoProvider} ${w.momoNumber} (${w.momoName})`,
    note: w.note,
    method: w.method,
    requestedAt: w.requestedAt.toISOString(),
    paidAt: w.paidAt ? w.paidAt.toISOString() : null,
    totalEarned: balances.get(w.driverId) ?? null,
    markedByMe: w.markedPaidBy === dbUser.id,
  })

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Withdrawals"
        lead="Drivers ask for their earnings to be sent to their mobile money wallet. Send pays through Paystack from your Paystack balance. If Paystack transfers aren't on for your account yet, pay from your MoMo business wallet and use Mark paid with the transaction ID; a different finance user then confirms it."
      />
      <WithdrawalsClient open={open.map(toRow)} recent={recent.map(toRow)} />
    </div>
  )
}
