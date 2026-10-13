import { redirect } from 'next/navigation'
import { AlertTriangle, FileText, ScrollText } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { AccountGroup, AccountRow, BackToAccount } from '@/components/driver/AccountRow'
import { Card } from '@/components/ui'
import DeleteAccount from '@/components/customer/DeleteAccount'
import { getWalletState } from '@/lib/wallet-server'
import { OPEN_WITHDRAWAL_STATUSES } from '@/lib/wallet'
import { driverDeleteBlockers } from '@/lib/driver-delete'

export const dynamic = 'force-dynamic'

const OPEN = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING', 'FAILED_PICKUP', 'DISPUTED'] as const
const accraDate = (d: Date) => d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default async function DriverPrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // What has to be done before the account can be deleted (the same check the delete request makes).
  const [openStops, openWithdrawals, wallet] = await Promise.all([
    prisma.order.count({ where: { driverId: user.id, status: { in: [...OPEN] } } }),
    prisma.withdrawal.count({ where: { driverId: user.id, status: { in: OPEN_WITHDRAWAL_STATUSES } } }),
    getWalletState(user.id),
  ])
  const blockers = driverDeleteBlockers({ openStops, openWithdrawals, wallet }, accraDate)

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <BackToAccount />
        <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Privacy and data</h1>
      </div>
      <AccountGroup title="Policies">
        <AccountRow href="/privacy-policy" icon={FileText} title="Privacy policy" />
        <AccountRow href="/terms" icon={ScrollText} title="Terms of service" />
      </AccountGroup>
      <p className="px-1 text-sm text-ink-3">
        Your Ghana Card number and photos are stored privately and seen only by the Trashit team who approve drivers. Earnings records are kept
        for accounting.
      </p>

      <Card>
        <h2 className="text-base font-semibold tracking-tight">Delete your account</h2>
        {blockers.length > 0 ? (
          <>
            <p className="mt-2 text-[15px] text-ink-2">You can delete your account once nothing is left in progress and no money is owed either way:</p>
            <ul className="mt-3 grid gap-2">
              {blockers.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[15px] text-ink">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" /> {b}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-4 mt-2 text-[15px] text-ink-2">Nothing is in progress and your balance is GHS 0, so you can delete your account.</p>
            <DeleteAccount who="driver" />
          </>
        )}
      </Card>
    </div>
  )
}
