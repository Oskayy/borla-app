import { redirect } from 'next/navigation'
import { Camera, Flag } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'

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
  const price = 50
  const pool = price * (1 - fee / 100)

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
            <dd>{money((pool * pickup) / 100)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-ink-2">
            <dt>At unload ({unload}%)</dt>
            <dd>{money((pool * unload) / 100)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
