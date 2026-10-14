import { redirect } from 'next/navigation'
import { ArrowDownToLine, Clock, FileText, History, Wallet } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getEarningsHistory, getWalletSummary } from '@/lib/wallet-server'
import { OPEN_WITHDRAWAL_STATUSES, payoutHoldEndsAt } from '@/lib/wallet'
import { MOMO_PROVIDERS } from '@/lib/phone'
import { ATTEMPT_TYPE, BONUS_TYPE, CLAWBACK_TYPE, CLEARING_HOURS, PICKUP_TYPE } from '@/lib/earnings'
import { SWEEP_MIN_PESEWAS, SWEEP_MINUTES } from '@/lib/treasury'
import { formatClock } from '@/lib/shift'
import { getPaystackTransfers } from '@/lib/settings'
import { dateLabel, dateTimeLabel } from '@/lib/format'
import Link from 'next/link'
import { Card, CardTitle } from '@/components/ui'
import BalanceAmount from '@/components/driver/BalanceAmount'
import PayoutAccountForm from '@/components/PayoutAccountForm'
import WithdrawForm from '@/components/WithdrawForm'

export const dynamic = 'force-dynamic'

const WITHDRAWAL_LABELS: Record<string, { text: string; cls: string }> = {
  REQUESTED: { text: 'Waiting', cls: 'bg-ops-wash text-ops-deep' },
  PROCESSING: { text: 'Being sent', cls: 'bg-ops-wash text-ops-deep' },
  CONFIRMING: { text: 'Being sent', cls: 'bg-ops-wash text-ops-deep' },
  PAID: { text: 'Sent', cls: 'bg-customer-wash text-customer-deep' },
  FAILED: { text: 'Failed, money back', cls: 'bg-danger-wash text-danger' },
  REJECTED: { text: 'Not approved, money back', cls: 'bg-danger-wash text-danger' },
}

const accraTime = (d: Date) =>
  d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

// Where one earning stands (outside the component: reads the clock).
function earningState(e: { type: string; clearsAt: Date | null }): string {
  if (e.type === CLAWBACK_TYPE) return 'Taken back after a refund'
  if (!e.clearsAt) return 'Clears after you unload'
  return e.clearsAt.getTime() <= Date.now() ? 'Available' : `Clears ${accraTime(e.clearsAt)}`
}

const EARNING_LABELS: Record<string, string> = {
  [PICKUP_TYPE]: 'Pickup share',
  driver_payout_disposal: 'Unload share',
  [ATTEMPT_TYPE]: 'Paid for a wasted trip',
  [BONUS_TYPE]: 'Distance bonus',
  [CLAWBACK_TYPE]: 'Taken back',
}

// Whether the driver already used today's free cash-out (Accra day; outside the component: reads the clock).
function cashedOutToday(ws: { source: string; status: string; requestedAt: Date }[]): boolean {
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' })
  const today = day(new Date())
  return ws.some((w) => w.source === 'cashout' && !['FAILED', 'REJECTED'].includes(w.status) && day(w.requestedAt) === today)
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

  const [wallet, history, withdrawals, transfersOn] = await Promise.all([
    getWalletSummary(user.id),
    getEarningsHistory(user.id),
    prisma.withdrawal.findMany({ where: { driverId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
    getPaystackTransfers(),
  ])
  const hasOpen = withdrawals.some((w: { status: string }) => OPEN_WITHDRAWAL_STATUSES.includes(w.status))
  const freeToday = !cashedOutToday(withdrawals)
  const holdUntil = holdEndsLabel(profile.momoChangedAt)
  const walletInitial = { momoNumber: profile.momoNumber ?? '', momoProvider: profile.momoProvider ?? 'MTN', momoName: profile.momoName ?? '' }
  const providerName = MOMO_PROVIDERS.find((p) => p.code === profile.momoProvider)?.name ?? profile.momoProvider

  return (
    <div>
      <h1 className="mb-4 text-[26px] font-bold leading-tight tracking-[-0.025em]">Earnings</h1>

      {/* The balance card: what can be cashed out now, with shortcuts. */}
      <section aria-label="Your balance" className="hero-glow anim-rise rounded-card bg-hero p-5 text-on-hero shadow-lift sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-on-hero-2">Available to withdraw</p>
          <Link
            href="/dashboard/driver/account/statements"
            className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[15px] font-semibold text-[#111113] hover:bg-white/90"
          >
            <FileText aria-hidden className="size-4" /> Statements
          </Link>
        </div>
        <BalanceAmount amount={wallet.available} />
        {wallet.reserve > 0 && <p className="mt-1 text-sm text-on-hero-2">GHS {wallet.reserve.toFixed(2)} kept back for your first 30 days</p>}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <a href="#cash-out" className="press flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/[0.12] px-3 text-[15px] font-semibold ring-1 ring-white/15 hover:bg-white/20">
            <ArrowDownToLine aria-hidden className="size-[18px]" /> Cash out
          </a>
          <Link
            href="/dashboard/driver/account/trips"
            className="press flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/[0.12] px-3 text-[15px] font-semibold ring-1 ring-white/15 hover:bg-white/20"
          >
            <History aria-hidden className="size-[18px]" /> Trip history
          </Link>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-surface p-4 sm:p-5">
          <p className="text-sm text-ink-3">Clearing</p>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">GHS {wallet.clearing.toFixed(2)}</p>
          <p className="mt-0.5 text-sm text-ink-3">
            {wallet.nextClearAt ? `Next amount available ${accraTime(wallet.nextClearAt)}` : `Available ${CLEARING_HOURS} h after the shift ends and you've unloaded`}
          </p>
        </div>
        <div className="rounded-card bg-surface p-4 sm:p-5">
          <p className="text-sm text-ink-3">Sent to your MoMo</p>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">GHS {wallet.paidOut.toFixed(2)}</p>
          {wallet.pending > 0 && <p className="mt-0.5 text-sm text-action-deep">GHS {wallet.pending.toFixed(2)} on its way</p>}
        </div>
      </div>

      {wallet.owed > 0 && (
        <p role="status" className="mt-4 rounded-card bg-danger-wash p-4 text-[15px] text-ink">
          GHS {wallet.owed.toFixed(2)} was taken back after a refund. It comes out of your next earnings before anything new is available. Nothing is
          taken from your MoMo wallet.
        </p>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        {/* One card: withdraw, and the wallet the money goes to. */}
        <Card className="scroll-mt-24" id="cash-out">
          <CardTitle>Withdraw to mobile money</CardTitle>
          {profile.momoNumber && (
            <p className="-mt-1 mb-4 text-[15px] text-ink-2">
              {transfersOn
                ? `Your available balance is sent to your wallet automatically every morning at ${formatClock(SWEEP_MINUTES)} (when it's GHS ${
                    SWEEP_MIN_PESEWAS / 100
                  } or more). Need it sooner? Cash out now.`
                : `Every morning from ${formatClock(SWEEP_MINUTES)}, Trashit sends your available balance to your wallet (when it's GHS ${
                    SWEEP_MIN_PESEWAS / 100
                  } or more). Need it sooner? Ask with Cash out now and Trashit sends it.`}
            </p>
          )}
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
                  <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-2" /> You have a withdrawal in progress. You can ask for another once it&apos;s
                  finished.
                </p>
              ) : holdUntil ? (
                <p className="rounded-control bg-driver-wash p-3.5 text-[15px] text-ink">
                  Your wallet was changed recently, so withdrawals are paused until <strong>{holdUntil}</strong> for your safety. If you didn&apos;t make
                  this change, contact Trashit straight away.
                </p>
              ) : wallet.available <= 0 ? (
                <p className="text-[15px] text-ink-2">Nothing to cash out yet. Earnings appear here once they&apos;ve cleared. Keep collecting!</p>
              ) : (
                <WithdrawForm available={wallet.available} walletLabel={`${providerName} ${profile.momoNumber}`} freeToday={freeToday} />
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
                  <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-canvas px-4 text-sm font-semibold text-ink ring-1 ring-line-strong group-open:hidden">
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
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-right text-xs font-bold ${WITHDRAWAL_LABELS[w.status]?.cls ?? 'bg-canvas text-ink-2'}`}>
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
                    {EARNING_LABELS[e.type] ?? 'Earning'} · {dateTimeLabel(e.createdAt)} · {earningState(e)}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${e.type === CLAWBACK_TYPE ? 'text-danger' : 'text-customer-deep'}`}>
                  {e.type === CLAWBACK_TYPE ? '−' : '+'} GHS {e.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  )
}
