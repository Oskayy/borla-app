import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarPlus, ChevronRight, Inbox } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { binsText, customerStatus, ghs, type OrderSnapshot } from '@/lib/order-status'
import { dateLabel } from '@/lib/format'
import { BUTTON_PRIMARY, EmptyState, PageHeader, StatusPill } from '@/components/ui'
import DeleteDraftButton from '@/components/DeleteDraftButton'

export const dynamic = 'force-dynamic'

export default async function OrderHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true, quoteSnapshot: true },
  })

  const rows = orders.map((o) => ({ ...o, s: customerStatus(o.status), q: o.quoteSnapshot as OrderSnapshot | null }))
  const groups = [
    { title: 'On the way', items: rows.filter((r) => r.s.active) },
    { title: 'Not paid', items: rows.filter((r) => r.status === 'DRAFT') },
    { title: 'Past pickups', items: rows.filter((r) => !r.s.active && r.status !== 'DRAFT') },
  ].filter((g) => g.items.length > 0)

  return (
    <div>
      <PageHeader
        title="My orders"
        lead="Every pickup you have booked, newest first."
        action={
          <Link href="/dashboard/customer/book" className={BUTTON_PRIMARY}>
            <CalendarPlus aria-hidden className="size-4" /> Book a pickup
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No pickups yet"
          text="Book your first pickup and it shows here, with each step through the night."
          action={
            <Link href="/dashboard/customer/book" className={BUTTON_PRIMARY}>
              <CalendarPlus aria-hidden className="size-4" /> Book a pickup
            </Link>
          }
        />
      ) : (
        <div className="grid gap-8">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 text-sm font-semibold text-ink-3">{g.title}</h2>
              <ul className="anim-stagger grid gap-2">
                {g.items.map((o) => (
                  <li key={o.id} className="lift flex items-center gap-2 rounded-[18px] bg-surface pr-3 ring-1 ring-line">
                    <Link
                      href={`/dashboard/customer/orders/${o.id}`}
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[18px] px-4 py-4 sm:px-5"
                    >
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block truncate font-semibold">{binsText(o.q) || 'Pickup'}</span>
                        <span className="block truncate text-sm text-ink-3">
                          {dateLabel(o.createdAt)} · {o.q?.address}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{ghs(o.q?.price)}</span>
                      <StatusPill status={o.s} />
                      <ChevronRight aria-hidden className="hidden size-4 text-ink-3 sm:block" />
                    </Link>
                    {o.status === 'DRAFT' && <DeleteDraftButton orderId={o.id} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
