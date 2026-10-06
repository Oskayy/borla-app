import { redirect } from 'next/navigation'
import { ArrowDownToLine, Clock, FileText, Wallet } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getEarningsHistory, getWalletSummary } from '@/lib/wallet-server'
import { MIN_WITHDRAWAL_GHS, OPEN_WITHDRAWAL_STATUSES, payoutHoldEndsAt } from '@/lib/wallet'
import { MOMO_PROVIDERS } from '@/lib/phone'
import { dateLabel, dateTimeLabel } from '@/lib/format'
import Link from 'next/link'
import { BUTTON_QUIET, Card, CardTitle, PageHeader } from '@/components/ui'
import PayoutAccountForm from '@/components/PayoutAccountForm'
import WithdrawForm from '@/components/WithdrawForm'

export const dynamic = 'force-dynamic'

const WITHDRAWAL_LABELS: Record<string, { text: string; cls: string }> = {
  REQUESTED: { text: 'Waiting for approval', cls: 'text-action-deep' },
  PROCESSING: { text: 'Being sent', cls: 'text-action-deep' },
  CONFIRMING: { text: 'Being sent', cls: 'text-action-deep' },
  PAID: { text: 'Sent', cls: 'text-customer-deep' },
  FAILED: { text: 'Failed, money back in your balance', cls: 'text-danger' },
  REJECTED: { text: 'Not approved, money back in your balance', cls: 'text-danger' },
}

// When the safety pause after a wallet change ends, as Accra time (or null). Outside the component: reads the clock.
function holdEndsLabel(changedAt: Date | null): string | null {
  const ends = payoutHoldEndsAt(changedAt, new Date())
  return ends ? ends.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : null
}

export default async function DriverEarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
    select: { momoNumber: true, momoProvider: true, momoName: true, approvalStatus: true, momoChangedAt: true },
  })
  if (!profile) redirect('/dashboard/driver/profile-setup')

  const [wallet, history, withdrawals] = await Promise.all([
    getWalletSummary(user.id),
    getEarningsHistory(user.id),
    prisma.withdrawal.findMany({ where: { driverId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
  ])
  const hasOpen = withdrawals.some((w: { status: string }) => OPEN_WITHDRAWAL_STATUSES.includes(w.status))
  const holdUntil = holdEndsLabel(profile.momoChangedAt)
  const walletInitial = { momoNumber: profile.momoNumber ?? '', momoProvider: profile.momoProvider ?? 'MTN', momoName: profile.momoName ?? '' }
  const providerName = MOMO_PROVIDERS.find((p) => p.code === profile.momoProvider)?.name ?? profile.momoProvider

  return (
    <div>
      <PageHeader
        title="Earnings"
        action={
          <Link href="/dashboard/driver/account/statements" className={BUTTON_QUIET}>
            <FileText aria-hidden className="size-4" /> Statements
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card bg-surface p-5 ring-1 ring-action/40 sm:col-span-1">
          <p className="text-sm text-ink-3">Available to withdraw</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-action">GHS {wallet.available.toFixed(2)}</p>
        </div>
        <div className="rounded-card bg-surface p-5 ring-1 ring-line">
          <p className="text-sm text-ink-3">Earned in total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">GHS {wallet.earned.toFixed(2)}</p>
        </div>
        <div className="rounded-card bg-surface p-5 ring-1 ring-line">
          <p className="text-sm text-ink-3">Sent to your MoMo</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">GHS {wallet.paidOut.toFixed(2)}</p>
          {wallet.pending > 0 && <p className="mt-0.5 text-sm text-action-deep">GHS {wallet.pending.toFixed(2)} on its way</p>}
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        {/* One card: withdraw, and the wallet the money goes to. */}
        <Card>
          <CardTitle>Withdraw to mobile money</CardTitle>
          {!profile.momoNumber ? (
            <>
              <p className="mb-4 text-[15px] text-ink-2">First, add the wallet your earnings go to.</p>
              <PayoutAccountForm initial={walletInitial} providers={MOMO_PROVIDERS} locked={hasOpen} />
            </>
          ) : (
            <>
              {profile.approvalStatus !== 'APPROVED' ? (
                <p className="text-[15px] text-ink-2">You can withdraw once your account is approved.</p>
              ) : hasOpen ? (
                <p className="flex items-start gap-2 text-[15px] text-ink-2">
                  <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-action" /> You have a withdrawal in progress. You can ask for another once it&apos;s
                  finished.
                </p>
              ) : holdUntil ? (
                <p className="rounded-control bg-driver-wash p-3.5 text-[15px] text-ink">
                  Your wallet was changed recently, so withdrawals are paused until <strong>{holdUntil}</strong> for your safety. If you didn&apos;t make
                  this change, contact Trashit straight away.
                </p>
              ) : wallet.available < MIN_WITHDRAWAL_GHS ? (
                <p className="text-[15px] text-ink-2">The smallest withdrawal is GHS {MIN_WITHDRAWAL_GHS}. Keep collecting!</p>
              ) : (
                <WithdrawForm available={wallet.available} walletLabel={`${providerName} ${profile.momoNumber}`} />
              )}

              <details className="group mt-5 border-t border-line pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink-3">Paid to</span>
                    <span className="block truncate font-semibold">
                      {providerName} {profile.momoNumber}
                      {profile.momoName && <span className="font-normal text-ink-3"> · {profile.momoName}</span>}
                    </span>
                  </span>
                  <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-3 text-sm font-semibold text-action-deep ring-1 ring-action/50 group-open:hidden">
                    Change
                  </span>
                  <span className="hidden min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-ink-3 group-open:inline-flex">Close</span>
                </summary>
                <div className="mt-4">
                  <PayoutAccountForm initial={walletInitial} providers={MOMO_PROVIDERS} locked={hasOpen} />
                </div>
              </details>
            </>
          )}
        </Card>

        <Card>
          <CardTitle>Withdrawals</CardTitle>
          {withdrawals.length === 0 ? (
            <p className="flex items-center gap-2 text-[15px] text-ink-3">
              <ArrowDownToLine aria-hidden className="size-4" /> None yet.
            </p>
          ) : (
            <ul className="-mx-1 divide-y divide-line">
              {withdrawals.map((w) => (
                <li key={w.id} className="flex items-start justify-between gap-3 px-1 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold tabular-nums">GHS {w.amount.toFixed(2)}</span>
                    <span className="block text-sm text-ink-3">
                      {dateLabel(w.requestedAt)} · {w.momoProvider} {w.momoNumber}
                      {w.note && (w.status === 'REJECTED' || w.status === 'FAILED') && ` · ${w.note}`}
                    </span>
                  </span>
                  <span className={`shrink-0 text-right text-sm font-semibold ${WITHDRAWAL_LABELS[w.status]?.cls ?? 'text-ink-3'}`}>
                    {WITHDRAWAL_LABELS[w.status]?.text ?? w.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Recent earnings</CardTitle>
        {history.length === 0 ? (
          <p className="flex items-center gap-2 text-[15px] text-ink-3">
            <Wallet aria-hidden className="size-4" /> No earnings yet. They appear here as you collect and unload.
          </p>
        ) : (
          <ul className="-mx-1 divide-y divide-line">
            {history.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-1 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{(e.order?.quoteSnapshot as { address?: string } | null)?.address ?? 'Order'}</span>
                  <span className="block text-sm text-ink-3">
                    {e.type === 'driver_payout_pickup' ? 'Pickup share' : 'Unload share'} · {dateTimeLabel(e.createdAt)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-customer-deep">+ GHS {e.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  )
}
