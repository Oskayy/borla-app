import { redirect } from 'next/navigation'
import { Camera, Clock, Flag } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'
import { attemptSplit, ATTEMPT_FEE_BPS, pctToBps, splitOrder } from '@/lib/money-split'
import { CLEARING_HOURS, NEW_DRIVER_DAYS, RESERVE_BPS, RESERVE_CAP_PESEWAS } from '@/lib/earnings'

export const dynamic = 'force-dynamic'

const money = (n: number) => `GHS ${n.toFixed(2)}`

// How a stop's pay is worked out, from the live payout and pricing rules, with a worked example.
export default async function DriverPayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [payout, pricing] = await Promise.all([
    prisma.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { pickupPercent: true, disposalPercent: true } }),
    prisma.pricingRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { platformFeePercent: true } }),
  ])
  const pickup = payout?.pickupPercent ?? 40
  const unload = payout?.disposalPercent ?? 60
  const fee = pricing?.platformFeePercent ?? 0
  // The same sums the app uses (lib/money-split.ts), on a GHS 50 example.
  const split = splitOrder(5000, pctToBps(fee), pctToBps(pickup))
  const attempt = attemptSplit(5000, pctToBps(fee))
  const price = split.price / 100
  const pool = split.pool / 100

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <BackToAccount />
        <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">How your pay is worked out</h1>
      </div>

      <Card>
        <ol className="grid gap-4 text-[15px]">
          <li>
            <p className="font-semibold">1. The customer pays for the stop</p>
            <p className="text-ink-2">Trashit keeps a {fee}% platform fee. The rest is your pay for the stop.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-action-wash text-action-deep">
              <Camera aria-hidden className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">2. {pickup}% when you confirm the pickup</span>
              <span className="block text-ink-2">With the photo at the gate.</span>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ops-wash text-ops-deep">
              <Flag aria-hidden className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">3. {unload}% when the unload is verified</span>
              <span className="block text-ink-2">By the disposal site&apos;s check, or by Trashit.</span>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2 ring-1 ring-line">
              <Clock aria-hidden className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">4. You can withdraw it {CLEARING_HOURS} hours after the shift ends</span>
              <span className="block text-ink-2">
                You see both shares straight away as &ldquo;Clearing&rdquo;. They become available {CLEARING_HOURS} hours after you unload or the
                shift ends, whichever is later, unless the customer has complained. A pickup that&apos;s never unloaded isn&apos;t paid until
                Trashit checks it.
              </span>
            </span>
          </li>
        </ol>
      </Card>

      <Card>
        <h2 className="text-base font-semibold tracking-tight">Example: a {money(price)} stop</h2>
        <dl className="mt-3 grid gap-2 text-[15px] tabular-nums">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Customer pays</dt>
            <dd>{money(price)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Platform fee ({fee}%)</dt>
            <dd>− {money(price - pool)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
            <dt>Your pay for the stop</dt>
            <dd>{money(pool)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-ink-2">
            <dt>At pickup ({pickup}%)</dt>
            <dd>{money(split.pickup / 100)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-ink-2">
            <dt>At unload ({unload}%)</dt>
            <dd>{money(split.unload / 100)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-3">The split is fixed when the customer pays, so a later change to these rules doesn&apos;t change that stop&apos;s pay.</p>
      </Card>

      <Card>
        <h2 className="text-base font-semibold tracking-tight">When things go wrong</h2>
        <ul className="mt-3 grid gap-3 text-[15px]">
          <li>
            <span className="block font-semibold">The customer&apos;s bins weren&apos;t out, or the gate was locked</span>
            <span className="block text-ink-2">
              Report it from the stop. If Trashit agrees it was the customer&apos;s side, you&apos;re paid for the trip: {money(attempt.driverShare / 100)} on a{' '}
              {money(price)} stop ({ATTEMPT_FEE_BPS / 100}% of the price, less the platform fee).
            </span>
          </li>
          <li>
            <span className="block font-semibold">A customer is refunded because of something you did</span>
            <span className="block text-ink-2">
              For example a pickup that was never unloaded. What you earned on that stop is taken back, up to the refund. If you&apos;ve already
              withdrawn it, it comes out of your next earnings. Nothing is ever taken from your MoMo wallet.
            </span>
          </li>
          <li>
            <span className="block font-semibold">Your first {NEW_DRIVER_DAYS} days</span>
            <span className="block text-ink-2">
              {RESERVE_BPS / 100}% of your last week&apos;s earnings (at most {money(RESERVE_CAP_PESEWAS / 100)}) stays in your balance until your first{' '}
              {NEW_DRIVER_DAYS} days are up.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
