import { redirect } from 'next/navigation'
import { ArrowDownToLine, Camera, Clock, FileText, Flag, Wallet } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getEarningsHistory, getWalletSummary } from '@/lib/wallet-server'
import { MIN_WITHDRAWAL_GHS, OPEN_WITHDRAWAL_STATUSES, payoutHoldEndsAt } from '@/lib/wallet'
import { MOMO_PROVIDERS } from '@/lib/phone'
import { dateLabel, dateTimeLabel } from '@/lib/format'
import { monthKey, monthLabel, recentMonths } from '@/lib/statement'
import { Card, CardTitle, PageHeader } from '@/components/ui'
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

  const [wallet, history, withdrawals, rule] = await Promise.all([
    getWalletSummary(user.id),
    getEarningsHistory(user.id),
    prisma.withdrawal.findMany({ where: { driverId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
    prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { pickupPercent: true, disposalPercent: true } }),
  ])
  const hasOpen = withdrawals.some((w: { status: string }) => OPEN_WITHDRAWAL_STATUSES.includes(w.status))
  const holdUntil = holdEndsLabel(profile.momoChangedAt)
  const providerName = MOMO_PROVIDERS.find((p) => p.code === profile.momoProvider)?.name ?? profile.momoProvider

  return (
    <div>
      <PageHeader title="Earnings" lead="Your balance, withdrawals to mobile money, and what each trip paid." />

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
        <Card>
          <CardTitle>Withdraw to mobile money</CardTitle>
          {profile.approvalStatus !== 'APPROVED' ? (
            <p className="text-[15px] text-ink-2">You can withdraw once your account is approved.</p>
          ) : !profile.momoNumber ? (
            <p className="text-[15px] text-ink-2">Add your MoMo wallet below first.</p>
          ) : hasOpen ? (
            <p className="flex items-start gap-2 text-[15px] text-ink-2">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-action" /> You have a withdrawal in progress. You can ask for another once it&apos;s finished.
            </p>
          ) : holdUntil ? (
            <p className="rounded-control bg-driver-wash p-3.5 text-[15px] text-ink">
              Your wallet was changed recently, so withdrawals are paused until <strong>{holdUntil}</strong> for your safety. If you didn&apos;t
              make this change, contact Trashit straight away.
            </p>
          ) : wallet.available < MIN_WITHDRAWAL_GHS ? (
            <p className="text-[15px] text-ink-2">The smallest withdrawal is GHS {MIN_WITHDRAWAL_GHS}. Keep collecting!</p>
          ) : (
            <WithdrawForm available={wallet.available} walletLabel={`${providerName} ${profile.momoNumber}`} />
          )}
        </Card>

        <Card>
          <CardTitle>How you&apos;re paid for each stop</CardTitle>
          <ol className="grid gap-3 text-[15px]">
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-action-wash text-action-deep">
                <Camera aria-hidden className="size-4" />
              </span>
              <span>
                <strong className="font-semibold">{rule ? `${rule.pickupPercent}%` : 'Part'} at pickup</strong>
                <span className="block text-ink-3">When you confirm the pickup with a photo at the gate.</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ops-wash text-ops-deep">
                <Flag aria-hidden className="size-4" />
              </span>
              <span>
                <strong className="font-semibold">{rule ? `${rule.disposalPercent}%` : 'The rest'} at unload</strong>
                <span className="block text-ink-3">When the unload at the disposal site is verified (by the site check, or by ops).</span>
              </span>
            </li>
          </ol>
          <p className="mt-4 text-sm text-ink-3">Shares are of the driver pool: the order price after Trashit&apos;s platform fee.</p>
        </Card>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>My MoMo wallet</CardTitle>
          <PayoutAccountForm
            initial={{ momoNumber: profile.momoNumber ?? '', momoProvider: profile.momoProvider ?? 'MTN', momoName: profile.momoName ?? '' }}
            providers={MOMO_PROVIDERS}
            locked={hasOpen}
          />
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

      <Card className="mt-6">
        <CardTitle>Monthly statements</CardTitle>
        <p className="mb-3 text-[15px] text-ink-3">Every pickup and unload share, and every withdrawal, for one month. PDF to keep or print, CSV for a spreadsheet.</p>
        <ul className="-mx-1 divide-y divide-line">
          {recentMonths(6).map((m) => (
            <li key={monthKey(m)} className="flex items-center justify-between gap-3 px-1 py-2">
              <span className="flex items-center gap-2 font-medium">
                <FileText aria-hidden className="size-4 text-ink-3" /> {monthLabel(m)}
              </span>
              <span className="flex gap-2">
                <a
                  href={`/api/driver/statement?month=${monthKey(m)}&format=pdf`}
                  className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-action-deep ring-1 ring-action/50 hover:bg-action-wash"
                  aria-label={`${monthLabel(m)} statement, PDF`}
                >
                  PDF
                </a>
                <a
                  href={`/api/driver/statement?month=${monthKey(m)}&format=csv`}
                  className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink-2 ring-1 ring-line-strong hover:bg-canvas"
                  aria-label={`${monthLabel(m)} statement, CSV`}
                >
                  CSV
                </a>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
