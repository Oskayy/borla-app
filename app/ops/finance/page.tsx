import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PAYOUT_ROLES } from '@/lib/wallet-server'
import { ACCOUNTS, TRANSFER_FEE_PESEWAS } from '@/lib/accounts'
import { getBalancePesewas } from '@/lib/paystack'
import { getShiftSettings } from '@/lib/settings'
import { localParts } from '@/lib/shift'
import { zonedInstant } from '@/lib/offers'
import { SWEEP_MINUTES, TOPUP_CHECK_MINUTES } from '@/lib/treasury'
import { formatClock } from '@/lib/shift'
import { dateLabel } from '@/lib/format'
import type { CheckResult } from '@/lib/reconcile'
import { PageHeader } from '@/components/ui'
import { AllClear, PANEL, SectionTitle } from '@/components/ops/kit'
import { ConfirmSettlement, OpeningBalanceForm, ReviewCheck, TopUpForm, TransfersSwitch } from '@/components/ops/FinanceActions'
import { getPaystackTransfers } from '@/lib/settings'

export const dynamic = 'force-dynamic'

const OPEN_REFUNDS = ['AWAITING_APPROVAL', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION']
const ghs = (p: number) => `GHS ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Row({ label, value, hint, strong, minus }: { label: string; value: number; hint?: string; strong?: boolean; minus?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 ${strong ? 'border-t border-line-strong font-semibold' : ''}`}>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-sm font-normal text-ink-3">{hint}</span>}
      </span>
      <span className={`shrink-0 tabular-nums ${strong ? 'text-lg' : ''}`}>
        {minus ? '− ' : ''}
        {ghs(value)}
      </span>
    </div>
  )
}

// Start of the month and of today, Accra time (reads the clock: outside the component).
function periods(timezone: string) {
  const { date } = localParts(new Date(), timezone)
  return { today: date, monthStart: zonedInstant(`${date.slice(0, 8)}01`, 0, timezone) }
}

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !PAYOUT_ROLES.includes(dbUser.role)) redirect('/ops')

  const [settings, transfersOn] = await Promise.all([getShiftSettings(), getPaystackTransfers()])
  const { today, monthStart } = periods(settings.timezone)
  const [byAccount, month, refunds, liveBalance, check, sweep, settlements, runs] = await Promise.all([
    prisma.posting.groupBy({ by: ['account'], _sum: { amount: true } }),
    prisma.posting.groupBy({ by: ['account'], where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.refund.aggregate({ where: { status: { in: OPEN_REFUNDS } }, _sum: { amount: true } }),
    getBalancePesewas(),
    prisma.treasuryCheck.findUnique({ where: { day: today } }),
    prisma.jobRun.findUnique({ where: { key: `sweep:${today}` } }),
    prisma.paystackSettlement.findMany({ orderBy: { settledAt: 'desc' }, take: 20 }),
    prisma.reconciliationRun.findMany({ orderBy: { day: 'desc' }, take: 14 }),
  ])
  const total = (rows: typeof byAccount, account: string) => rows.find((r) => r.account === account)?._sum.amount ?? 0

  const bank = total(byAccount, ACCOUNTS.bank)
  const paystack = total(byAccount, ACCOUNTS.paystackBalance)
  const clearing = total(byAccount, ACCOUNTS.paystackClearing)
  const held = -total(byAccount, ACCOUNTS.customerFundsHeld)
  const owed = -total(byAccount, ACCOUNTS.driverPayable)
  const refunding = Math.round((refunds._sum.amount ?? 0) * 100)
  const own = bank + paystack + clearing - held - owed - refunding
  const opening = -total(byAccount, ACCOUNTS.openingBalances)
  // Paystack's balance minus what the ledger has, less payouts still on their way: the gap an opening balance closes.
  const inFlight = await prisma.withdrawal.findMany({ where: { status: 'PROCESSING', method: 'paystack' }, select: { amount: true, feePesewas: true, withholdingPesewas: true } })
  const gap =
    liveBalance == null ? null : liveBalance - (paystack - inFlight.reduce((s, w) => s + Math.round(w.amount * 100) - w.feePesewas - w.withholdingPesewas + TRANSFER_FEE_PESEWAS, 0))

  const income = -total(month, ACCOUNTS.platformFeeIncome)
  const payFees = total(month, ACCOUNTS.paymentFees)
  const transferFees = total(month, ACCOUNTS.transferFees)
  const losses = total(month, ACCOUNTS.refundLosses)
  const differences = total(month, ACCOUNTS.reconciliationDifferences)

  const toConfirm = settlements.filter((s) => !s.confirmedAt)
  const confirmed = settlements.filter((s) => s.confirmedAt).slice(0, 8)

  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader
        title="Finance"
        lead="Whose money is whose, what Trashit earned this month, the morning payout check, and the daily match against Paystack. Figures come from the ledger; bank figures come from the settlements and top-ups recorded here."
      />

      <section aria-labelledby="h-whose" className={PANEL}>
        <SectionTitle id="h-whose">Whose money is it?</SectionTitle>
        <div className="divide-y divide-line text-[15px]">
          <Row label="In the bank" value={bank} hint="Settlements confirmed here, less top-ups and payouts made by hand" />
          <Row
            label="Paystack balance"
            value={paystack}
            hint={liveBalance == null ? 'Paystack didn’t answer just now' : `Paystack shows ${ghs(liveBalance)} now`}
          />
          <Row label="With Paystack, not yet settled" value={clearing} hint="Customer payments Paystack hasn’t sent to the bank yet" />
          <Row label="Held for customers" value={held} minus hint="Paid for pickups not finished yet" />
          <Row label="Owed to drivers" value={owed} minus hint="Earned and not paid out yet (clearing and available)" />
          <Row label="Refunds started, not yet sent" value={refunding} minus />
          <Row label="Trashit’s own money" value={own} strong />
        </div>
      </section>

      <section aria-labelledby="h-month" className={PANEL}>
        <SectionTitle id="h-month">This month</SectionTitle>
        <div className="divide-y divide-line text-[15px]">
          <Row label="Platform fees earned" value={income} hint="Counted when each job is finished" />
          <Row label="Paystack payment fees" value={payFees} minus />
          <Row label="Payout transfer fees" value={transferFees} minus />
          <Row label="Refunds Trashit paid itself" value={losses} minus />
          {differences !== 0 && <Row label="Differences to explain" value={differences} minus />}
          <Row label="Margin" value={income - payFees - transferFees - losses - differences} strong />
        </div>
      </section>

      <section aria-labelledby="h-transfers" className={PANEL}>
        <SectionTitle id="h-transfers">Paystack transfers: {transfersOn ? 'on' : 'off'}</SectionTitle>
        <p className="mb-4 text-[15px] text-ink-2">
          {transfersOn
            ? 'Driver payouts are sent through Paystack: the daily payout at 10am and Cash out now (up to GHS 500) go out straight away, from the Paystack balance.'
            : 'Driver payouts are not sent through Paystack. Each morning’s payouts and every Cash out now wait on the Withdrawals page; pay them from your MoMo business wallet and use Mark paid. Switch this on once Paystack upgrades the account to a Registered Business with transfers.'}
        </p>
        <TransfersSwitch on={transfersOn} />
      </section>

      <section aria-labelledby="h-payouts" className={PANEL}>
        <SectionTitle id="h-payouts">Today’s driver payouts</SectionTitle>
        {check ? (
          <p className="text-[15px] text-ink-2">
            {formatClock(TOPUP_CHECK_MINUTES)} check: {check.drivers} {check.drivers === 1 ? 'driver' : 'drivers'} due {ghs(check.duePesewas)}, plus{' '}
            {ghs(check.feesPesewas)} in fees and {ghs(check.bufferPesewas)} headroom. The Paystack balance was{' '}
            {check.balancePesewas == null ? 'not reported' : ghs(check.balancePesewas)}.{' '}
            {check.topUpPesewas > 0 ? <strong className="text-danger">Top up {ghs(check.topUpPesewas)}.</strong> : 'No top-up needed.'}
          </p>
        ) : (
          <p className="text-[15px] text-ink-3">The morning check runs at {formatClock(TOPUP_CHECK_MINUTES)}.</p>
        )}
        <p className="mt-2 text-[15px] text-ink-2">
          {sweep?.summary
            ? `Sweep: ${sweep.summary}.`
            : `The sweep pays each driver's available balance from ${formatClock(SWEEP_MINUTES)}. It waits until the Paystack balance covers every payout.`}
        </p>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 font-semibold">Record a top-up</p>
          <TopUpForm />
        </div>
      </section>

      <section aria-labelledby="h-opening" className={PANEL}>
        <SectionTitle id="h-opening">Opening balances</SectionTitle>
        <p className="mb-4 text-[15px] text-ink-2">
          Money that was already in the Paystack balance or the bank when the ledger started, or when Paystack moves from test to live. It
          isn&apos;t income or a top-up.{' '}
          {gap == null
            ? 'Paystack didn’t report its balance just now.'
            : gap === 0
            ? 'The Paystack balance matches the ledger.'
            : `Paystack shows ${ghs(liveBalance!)}; the ledger expects ${ghs(liveBalance! - gap)}, a gap of ${ghs(gap)}.`}
          {opening !== 0 && ` Recorded so far: ${ghs(opening)}.`}
        </p>
        <OpeningBalanceForm suggestedPaystack={gap != null && gap !== 0 ? gap / 100 : null} />
      </section>

      <section aria-labelledby="h-settle">
        <SectionTitle id="h-settle" count={toConfirm.length} hint="Paystack sends customer payments to the bank in settlements. Confirm each one when it arrives.">
          Settlements to confirm
        </SectionTitle>
        {toConfirm.length === 0 ? (
          <AllClear>Nothing to confirm.</AllClear>
        ) : (
          <ul className="grid gap-3">
            {toConfirm.map((s) => (
              <li key={s.id} className={`${PANEL} flex flex-wrap items-center justify-between gap-3`}>
                <span>
                  <span className="block font-semibold tabular-nums">{ghs(s.amountPesewas)}</span>
                  <span className="block text-sm text-ink-3">
                    Paystack settlement {s.paystackId} · {dateLabel(s.settledAt)} · {s.status}
                  </span>
                </span>
                <ConfirmSettlement id={s.id} expected={s.amountPesewas / 100} />
              </li>
            ))}
          </ul>
        )}
        {confirmed.length > 0 && (
          <p className="mt-3 text-sm text-ink-3">
            Recently confirmed:{' '}
            {confirmed
              .map((s) => `${dateLabel(s.settledAt)} ${ghs(s.receivedPesewas ?? s.amountPesewas)}${s.receivedPesewas != null && s.receivedPesewas !== s.amountPesewas ? ' (differs)' : ''}`)
              .join(' · ')}
          </p>
        )}
      </section>

      <section aria-labelledby="h-checks">
        <SectionTitle id="h-checks" hint="Every morning yesterday is checked against Paystack and the ledger. Any difference that isn’t zero shows here until someone looks at it.">
          Daily money checks
        </SectionTitle>
        {runs.length === 0 ? (
          <AllClear>The first check runs tomorrow at {formatClock(TOPUP_CHECK_MINUTES)}.</AllClear>
        ) : (
          <ul className="grid gap-3">
            {runs.map((r) => {
              const results = (r.results as unknown as CheckResult[]) ?? []
              return (
                <li key={r.id} className={PANEL}>
                  <p className="flex items-center gap-2 font-semibold">
                    {r.ok ? <CheckCircle2 aria-hidden className="size-5 text-ops" /> : <XCircle aria-hidden className="size-5 text-danger" />}
                    {dateLabel(`${r.day}T12:00:00Z`)}: {r.ok ? 'everything matches' : 'differences found'}
                    {r.reviewedAt && <span className="font-normal text-ink-3">· checked: {r.reviewNote}</span>}
                  </p>
                  {!r.ok && (
                    <>
                      <ul className="mt-2 grid gap-1.5 text-sm">
                        {results.map((c) => (
                          <li key={c.name} className={c.ok ? 'text-ink-3' : 'text-ink'}>
                            <span className="font-medium">{c.name}:</span> {c.summary}
                            {!c.ok && c.details.length > 0 && <span className="block pl-4 text-ink-2">{c.details.join(' · ')}</span>}
                          </li>
                        ))}
                      </ul>
                      {!r.reviewedAt && <ReviewCheck day={r.day} />}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
